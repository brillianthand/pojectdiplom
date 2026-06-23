# CLAUDE.md

## Команды

```bash
# Фронтенд
npm run dev       # Vite dev сервер → http://localhost:5173
npm run build     # Продакшн сборка → dist/
npm run lint      # ESLint

# Бэкенд
cd backend
go run ./cmd/server   # Запуск API на :8080
go build ./...        # Проверка компиляции

# База данных (нужен Postgres)
# Задайте DATABASE_URL или используйте дефолт: host=localhost port=5432 user=postgres password=1234 dbname=kanban
# Миграции запускаются автоматически при старте через embed.FS
```

Тестовый раннер не настроен.

## Что построено

Система управления проектами в стиле YouGile (канбан-доска — один из видов отображения) — React 19 + Vite 8 + Tailwind CSS v4 + Zustand + @dnd-kit на фронтенде, Go + Postgres на бэкенде (модульная архитектура, только `net/http`, без фреймворков).

## Архитектура

### Бэкенд — модульная архитектура (`backend/`)

```
backend/
  cmd/server/main.go              — bootstrap: env, DI, http.Server
  internal/
    platform/
      db/                         — Open(), WithTx(), ApplyMigrations() (embed.FS)
        migrations/
          0001_init.sql           — projects, boards, columns, tasks, task_tags, task_assignees, comments
          0002_users.sql          — users, owner_id в projects, created_by в tasks
          0003_project_members.sql— project_members(project_id, user_id, role)
          0004_notifications.sql  — notifications(id, user_id, type, title, read)
          0005_subtasks.sql       — subtasks(id, task_id, title, completed, position)
          0006_project_invitations.sql — project_invitations (удалена в 0008)
          0007_fix_task_priority_default.sql — дефолт priority → пустая строка
          0008_member_roles_and_invites.sql  — project_members.status ('pending'|'accepted'),
                                               notifications.project_id + invited_by;
                                               дропает project_invitations
          0009_owner_role.sql     — переименование 'manager' → 'owner' в project_members
          0010_indexes_and_fk.sql — FK task_assignees.member_id → users.id, индексы
          0011_archive.sql        — tasks.archived_at, columns.archived_at
          0012_share_token.sql    — boards.share_token + уникальный частичный индекс
          0013_task_events.sql    — task_events(id, task_id, user_id, type, payload JSONB, created_at)
          0014_notifications_task_link.sql — notifications.task_id, notifications.board_id
          0015_admin.sql          — users.is_admin, users.is_blocked + авто-промоут самого
                                    раннего по created_at пользователя в админы (DO-блок,
                                    срабатывает один раз при первом прогоне миграции)
          0016_user_avatar.sql    — users.avatar_url TEXT NOT NULL DEFAULT ''
          0017_notifications_actor.sql — notifications.actor_id (кто совершил действие)
          0018_task_completed_at.sql   — tasks.completed_at + backfill из task_events
          0019_project_roles.sql  — новая ролевая модель: 'admin'|'manager'|'executor'|'observer'
                                    с CHECK-ограничением на уровне БД
          0020_task_stars.sql     — task_stars(user_id, task_id) PK; персональные «избранные»
                                    с CASCADE на удаление юзера/задачи; idx по (user_id, created_at DESC)
          0021_board_settings.sql — boards.settings JSONB DEFAULT '{}'; per-board автоматизация:
                                    autoMoveOnComplete, autoMoveColumnId, autoArchiveEnabled, autoArchiveDays
      httpx/                      — WriteJSON, ErrJSON, Decode, CORS(origin) middleware
      ids/                        — ids.New() (crypto/rand hex)
      timeago/                    — Relative(t time.Time) string
    auth/                         — GenerateToken, ParseToken, RequireAuth middleware,
                                    register/login/me/updateProfile/changePassword;
                                    аватары хранятся как data URL (PNG/JPEG/WEBP/GIF, max 512 KB);
                                    блок-чек: заблокированные не проходят логин и RequireAuth (403);
                                    при регистрации, если в системе нет ни одного админа —
                                    новый юзер автоматически получает is_admin=true
    admin/                        — Handler, Repository, RequireAdmin middleware;
                                    управление пользователями (только для is_admin)
    users/                        — User type (id,email,name,color,avatarUrl,initials,isAdmin,
                                    isBlocked,createdAt), ColorForID, InitialsFor,
                                    Repository (HasAdmin, PromoteToAdmin); GET /api/users
    projects/                     — Handler, Service, Repository; transfer-ownership
    boards/                       — Handler(svc, hub, membersRepo), Service, Repository;
                                    types: Board (с Settings), BoardSettings, Column, Detail, ColumnTemplate;
                                    шаблоны колонок: empty, kanban, scrum;
                                    публичный доступ по share_token (GET /api/shared/{token});
                                    per-board настройки автоматизации (PUT /api/boards/{id}/settings)
    tasks/                        — Handler(svc, hub, notifSvc, membersRepo), Service, Repository;
                                    types: Task, Subtask, Comment, TaskEvent (15 типов), FeedItem;
                                    дублирование, архивирование/восстановление, история событий;
                                    «звёзды» (task_stars) и кросс-проектная лента активности (/api/feed)
    members/                      — Handler, Service, Repository; permissions.go (RBAC);
                                    invite by email или userID, project_members;
                                    RoleByProject/Board/Column/Task/Comment/Subtask — резолверы роли по entity ID;
                                    при смене роли отправляется notification type='role_changed'
    notifications/                — Handler, Service, Repository;
                                    5 типов: invite/assigned/commented/mentioned/role_changed;
                                    курсорная пагинация List(userID, before) с hasMore
    realtime/                     — Hub (gorilla/websocket), Client, ServeWS; broadcast при мутациях доски
    workspace/                    — Handler, Service, Repository; GET /api/workspace — агрегированная статистика
    seed/                         — seed.Handler(db), seed.Run(ctx, db)
  go.mod                          — module kanban; deps: pq, jwt/v5, bcrypt, gorilla/websocket
```

**Ключевые паттерны бэкенда:**

- Все маршруты `/api/*`, кроме `/api/auth/*`, `/api/health`, `/api/seed`, `/api/boards/{id}/ws`, `/api/shared/{token}`, защищены middleware `auth.RequireAuth`.
- WS-аутентификация через query-параметр `?token=` (браузеры не могут задать заголовки при WebSocket-соединении).
- `db.WithTx(ctx, db, fn)` — для многошаговых мутаций (создание/перемещение задачи, создание проекта).
- Интерфейс `Querier` в boards позволяет методам репозитория принимать `*sql.DB` или `*sql.Tx`.
- Интерфейс `BoardCreator` в projects — чтобы избежать циклического импорта с пакетом boards.
- Заголовок `X-Client-ID` в каждом HTTP-запросе → возвращается в WS-broadcast → фронтенд фильтрует свои события.
- Шина событий: после каждой мутации хендлер вызывает `hub.Publish(boardID, eventType, clientID)`.
- Приглашения участников: `POST /api/projects/{id}/members` создаёт запись `project_members` со `status='pending'` и уведомление `type='invite'`; принятие/отклонение через `/api/invitations/{projectId}/accept|decline`.
- RBAC через `members/permissions.go`: 4 роли (admin > manager > executor > observer), предикаты `CanManageProject`, `CanManageMembers`, `CanManageBoards`, `CanEditTasks`, `CanComment`, `CanBeAssignee`, `CanView`. Роль резолвится через контекст задачи/доски/проекта.
- Системный админ: `users.is_admin` — глобальная роль, не путать с `project_members.role='admin'`. Маршруты `/api/admin/*` дополнительно обёрнуты в `admin.RequireAdmin`. Защиты: нельзя снять с себя is_admin, нельзя себя заблокировать/удалить, нельзя оставить систему без is_admin.
- Блокировка пользователя: `users.is_blocked = TRUE` → логин возвращает 403, активные JWT отклоняются `RequireAuth`.
- Публичные доски: `GET /api/shared/{token}` — без auth, только чтение; токен генерируется через `POST /api/boards/{id}/share`.
- История задачи: каждое изменение пишется в `task_events` (JSONB payload), 14 типов событий: `created`, `title_changed`, `description_changed`, `priority_changed`, `type_changed`, `start_date_changed`, `due_date_changed`, `completed_changed`, `moved`, `assignee_added`, `assignee_removed`, `tag_added`, `tag_removed`, `archived`/`restored`.
- Поиск задач: `GET /api/search?q=...` — полнотекстовый, минимум 2 символа, limit 15, только по проектам, в которых состоит юзер.
- @mention в комментариях: парсятся `@<userId>` (не `@имя`!) → создаётся уведомление `type='mentioned'` упомянутому юзеру. Если адресат одновременно и assignee, и упомянут — приходит только более специфичное `mentioned`.
- Лента активности: `GET /api/feed?limit=20` — кросс-проектные события из `task_events` с обогащением (task/board/project context) для рендера на WorkspaceView без N+1.
- Звёзды (избранное): `POST/DELETE /api/tasks/{id}/star`, `GET /api/stars` — список ID-ов; хранятся в `task_stars(user_id, task_id)` с CASCADE.
- Per-board настройки автоматизации: `boards.settings` (JSONB). `autoMoveOnComplete` — при completed=true задача переезжает в `autoMoveColumnId` (или последнюю колонку, если пусто). `autoArchiveEnabled` + `autoArchiveDays` — фоновое архивирование (флаг хранится, исполнитель — фронт через `toggleTaskComplete`). Дефолты применяются в `DefaultSettings()`.
- Уведомления о смене роли: `type='role_changed'`, несёт `projectId` и `actorId`, открывается на view `members` нужного проекта.

**Все HTTP-маршруты бэкенда:**

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/profile
POST   /api/auth/change-password
GET    /api/health
POST   /api/seed
GET    /api/boards/{id}/ws                          — WebSocket (auth через ?token=)
GET    /api/shared/{token}                          — публичная доска (без auth)

GET    /api/users                                   — список всех пользователей
GET    /api/workspace                               — агрегированная статистика
GET    /api/search?q=...                            — поиск задач (min 2 символа)
GET    /api/feed?limit=20                           — кросс-проектная лента активности
GET    /api/stars                                   — ID-ы задач, отмеченных звездой

GET    /api/projects
POST   /api/projects
PUT    /api/projects/{id}
DELETE /api/projects/{id}
POST   /api/projects/{id}/transfer-ownership        — передача прав (только admin проекта)

POST   /api/projects/{id}/boards
GET    /api/projects/{id}/members
POST   /api/projects/{id}/members                  — пригласить по email (status='pending')
PATCH  /api/projects/{id}/members/{userId}         — изменить роль
DELETE /api/projects/{id}/members/{userId}

POST   /api/invitations/{projectId}/accept
POST   /api/invitations/{projectId}/decline

GET    /api/boards/{id}
PUT    /api/boards/{id}
DELETE /api/boards/{id}
PUT    /api/boards/{id}/columns/reorder
PUT    /api/boards/{id}/settings                   — обновить BoardSettings (auto-move/auto-archive)
POST   /api/boards/{id}/share                      — генерация share_token
GET    /api/boards/{id}/archive                    — список архивированных задач/колонок

POST   /api/boards/{id}/columns
PUT    /api/columns/{id}
DELETE /api/columns/{id}

POST   /api/columns/{id}/tasks
GET    /api/tasks/{id}
PUT    /api/tasks/{id}
DELETE /api/tasks/{id}
PUT    /api/tasks/{id}/move
POST   /api/tasks/{id}/duplicate                   — дублирование задачи
POST   /api/tasks/{id}/archive                     — архивировать
POST   /api/tasks/{id}/restore                     — восстановить из архива
GET    /api/tasks/{id}/events                      — история изменений задачи

POST   /api/tasks/{id}/star                        — добавить в избранное
DELETE /api/tasks/{id}/star                        — убрать из избранного

POST   /api/tasks/{id}/comments
PUT    /api/tasks/{id}/comments/{cid}
DELETE /api/comments/{id}

POST   /api/tasks/{id}/subtasks
PUT    /api/subtasks/{id}
DELETE /api/subtasks/{id}

GET    /api/notifications
GET    /api/notifications/count
PUT    /api/notifications/read                     — отметить все прочитанными
PUT    /api/notifications/{id}/read                — отметить одно прочитанным

GET    /api/admin/users                             — расширенный список (только is_admin)
GET    /api/admin/stats                             — KPI: total, admins, blocked, active, newLast7d
PATCH  /api/admin/users/{id}                        — { isAdmin?, isBlocked? }
DELETE /api/admin/users/{id}                        — удалить пользователя
```

### Фронтенд

**Стек:** React 19, Vite 8, Tailwind CSS v4 (без tailwind.config.js — всё в `src/index.css`), Zustand, @dnd-kit, Lucide icons.

**Маршрутизация:** через поле `view` в хранилище — без react-router.

```
Значения view:
  'login' | 'register'            — экраны авторизации
  'workspace'                     — главная страница рабочего пространства (дефолт после логина)
  'board' | 'list' | 'calendar'   — виды доски (показывают полный Header с фильтр-баром)
  'members'                       — управление участниками проекта
  'my-tasks' | 'notifications' | 'reports' | 'settings' — дополнительные виды
  'admin'                         — админ-панель (только для currentUser.isAdmin)
  'no-projects'                   — заглушка, когда нет проектов
```

**Форма хранилища (`src/store/useStore.js`):**

```js
{
  theme, view, filters, searchQuery,
  activeProjectId, activeTaskId,
  activeArchivedTask,  // полная Task, подгруженная для просмотра из архива (вне активной доски)
  initialized, apiError,
  currentUser,   // { id, email, name, color, avatarUrl, initials, isAdmin, isBlocked, createdAt } | null
  clientId,      // случайная строка для фильтрации WS-эхо
  projects: [{ id, name, color, icon, boards: [{id,name}], activeBoardId }],
  boards: { [boardId]: { columns: [{id,title,color,textColor}], tasks: {[colId]:[Task]}, settings: BoardSettings } },
  members: { [projectId]: [Member] },
  notifications:        [Notification],
  unreadCount:          0,
  hasMoreNotifications: false,        // курсорная пагинация (?before=createdAt)
  users:        [User],   // все пользователи системы (для выбора в CreateProjectModal)
  workspace:    Workspace | null,
  taskEvents:   { [taskId]: TaskEvent[] },
  starredIds:   Set<string>,          // ID-ы избранных задач, гидрируются один раз на старте
  feed:         [FeedItem],           // кросс-проектная лента событий для WorkspaceView
  feedLoading:  bool,
  adminUsers:   [UserRow], // расширенные данные для админ-панели
  adminStats:   Stats|null,
  adminLoading: bool,
  _workspaceFetching: Promise|null,   // дедупликация одновременных loadWorkspace()
}
```

**Форма Workspace:**

```js
{
  projects: [{ id, name, color, icon, ownerId, activeBoardId,
               membersCount, boardsCount, tasksTotal, tasksDone, lastActivity }],
  people: [{ id, email, name, color, avatarUrl, initials, projectsCount, isYou }],
  pendingInvites: [{ email, projectsCount }],
  totals: { projectsCount, peopleCount, tasksOpen }
}
```

**Ключевые экшены хранилища:**

- `initialize()` — вызывает `api.me()` сначала; при ошибке → `view:'login'`; при успехе → `_loadApp()`
- `_loadApp()` — загружает проекты, восстанавливает view из localStorage, запускает `loadWorkspace()`, `loadNotifications()`, `loadStars()`, polling уведомлений каждые 30с; восстанавливает `activeTaskId` из `#task=<id>` в URL
- `login(email,password)` / `register(email,password,name)` — сохраняет токен, вызывает `_loadApp()`
- `logout()` — `wsDisconnect()`, сбрасывает стейт (включая `starredIds`, `feed`), `view:'login'`
- `updateProfile({ name, avatarUrl })` / `changePassword({ oldPassword, newPassword })`
- `loadBoard(boardId)` — загружает данные доски + `connectBoard(boardId, clientId, applyRemoteEvent)`; при 404 удаляет доску из стейта и переключает на workspace
- `fetchBoardData(boardId)` — только загрузка, без WS (для предзагрузки в MyTasksView)
- `loadAllProjectBoards()` / `loadAllBoardsAcrossProjects()` — предзагрузка всех досок
- `loadWorkspace()` — загружает агрегированную статистику; защищена от параллельных вызовов через `_workspaceFetching`
- `loadFeed(limit=20)` — загружает кросс-проектную ленту активности
- `loadStars()` / `toggleStar(taskId)` — избранное; toggle оптимистичный с откатом при ошибке
- `loadUsers()` — загружает список всех пользователей системы
- `applyRemoteEvent(event)` — пропускает, если own clientId, иначе `loadBoard(event.boardId)`; на `taskUpdated` рефрешит счётчик уведомлений; если открыт TaskModal — обновляет `taskEvents`
- `setActiveProject(id)` — переключает проект, устанавливает `view:'board'`
- `setActiveBoard(boardId)` — переключает доску, переподключает WS, сохраняет в localStorage `kanban_active_board_<projectId>`
- `loadMembers(projectId)` / `inviteMember(email, role)` / `removeMember(userId)` / `updateMemberRole(userId, role)`
- `acceptInvite(projectId)` / `declineInvite(projectId)` — принять/отклонить приглашение
- `loadNotifications()` / `loadMoreNotifications()` — курсорная пагинация по `createdAt`
- `markNotificationsRead()` / `markNotificationRead(id)` / `openNotification(notif)` — открыть entity; для `type='role_changed'` ведёт на `view:'members'` нужного проекта
- `addBoard(name)` / `deleteBoard(boardId)` / `renameBoard(boardId, name)`
- `createProject(data)` / `deleteProject(projectId)` / `updateProject(projectId, updates)` / `transferOwnership(projectId, userId)`
- `setActiveTask(id)` / `openArchivedTask(taskId)` / `closeTask()` — управление TaskModal; синхронизирует `#task=<id>` в URL
- `addTask(colId, title)` / `addTaskWithDate(colId, dueDate, title, assignees)` — создание (calendar quick-add)
- `updateTask(taskId, updates)` / `archiveTask(taskId)` / `restoreTask(taskId)` / `duplicateTask(taskId)` / `deleteTask(taskId)` / `navigateToTask(taskId, boardId, projectId)`
- `toggleTaskComplete(taskId, boardId?)` — переключает `completed`; если доска включила `autoMoveOnComplete`, переносит карточку в `autoMoveColumnId` (или последнюю колонку, если ID пуст)
- `updateBoardSettings(changes)` — оптимистично мержит и сохраняет `BoardSettings` активной доски; откат при ошибке
- `loadTaskEvents(taskId)` — загрузить историю изменений задачи
- `loadAdmin()` — загружает `adminUsers` + `adminStats` параллельно
- `adminUpdateUser(id, { isAdmin?, isBlocked? })` / `adminDeleteUser(id)` — оптимистичные обновления с откатом при ошибке

**API (`src/api/index.js`):** каждый запрос отправляет `Authorization: Bearer <token>` + `X-Client-ID: <clientId>`. 401 → `setUnauthorizedHandler` callback → `logout()`.

Полный список функций API: `register`, `login`, `me`, `updateProfile`, `changePassword`, `seed`, `getUsers`, `getProjects`, `createProject`, `updateProject`, `deleteProject`, `transferOwnership`, `createBoard`, `updateBoard`, `deleteBoard`, `getBoard`, `shareBoard`, `updateBoardSettings`, `reorderColumns`, `createColumn`, `updateColumn`, `deleteColumn`, `search`, `getTask`, `getTaskEvents`, `createTask`, `updateTask`, `deleteTask`, `moveTask`, `duplicateTask`, `archiveTask`, `restoreTask`, `listArchived`, `addComment`, `updateComment`, `deleteComment`, `createSubtask`, `updateSubtask`, `deleteSubtask`, `getMembers`, `inviteMember`, `updateMemberRole`, `removeMember`, `acceptInvite`, `declineInvite`, `starTask`, `unstarTask`, `getStars`, `getFeed`, `getWorkspace`, `getNotifications`, `getNotifCount`, `markNotificationsRead`, `markNotificationRead`, `adminListUsers`, `adminStats`, `adminPatchUser`, `adminDeleteUser`.

(Примечание: `getSharedBoard` в API-обвязке нет — публичная доска фетчится напрямую `fetch(/api/shared/{token})` из компонента.)

**WebSocket (`src/api/ws.js`):** `connectBoard(boardId, clientId, onEvent)` — подключается к `ws://…/api/boards/{id}/ws?token=…`; авто-реконнект с экспоненциальной задержкой (до 30с).

### Дерево компонентов

```
App
├── LoginPage / RegisterPage       (src/components/auth/)
├── Sidebar                        (src/components/layout/Sidebar.jsx)
├── Header                         (src/components/layout/Header.jsx)
│   ├── FilterDropdown             — только для board/list/calendar
│   ├── GlobalSearch               (src/components/layout/GlobalSearch.jsx) — поиск задач
│   ├── NotificationDropdown       (src/components/notifications/NotificationDropdown.jsx)
│   └── ProfileDropdown (локальный)— аватар + меню (initials, color, avatarUrl)
├── WorkspaceView                  (src/components/views/WorkspaceView.jsx)
│   │                              — KPI, проекты, лента активности (FeedRow + describeFeed),
│   │                              — недавно открытые сущности (RecentRow из recents.js)
│   ├── CreateProjectModal         (src/components/project/CreateProjectModal.jsx)
│   └── ProjectModal               (src/components/project/ProjectModal.jsx)
├── Board                          (src/components/board/Board.jsx)
│   ├── BoardSkeleton              (src/components/board/BoardSkeleton.jsx) — скелетон загрузки
│   ├── DndContext                 — observer не может тащить (activationConstraint distance=999999)
│   ├── Column[] → TaskCard[]
│   ├── DragOverlay
│   ├── BoardSettingsModal         (src/components/board/BoardSettingsModal.jsx)
│   │                              — вкладка «Основные»: auto-move, auto-archive (доступна manager+)
│   └── ArchivePanel               (src/components/board/ArchivePanel.jsx) — архив задач
├── ListView                       (src/components/views/ListView.jsx)
├── CalendarView                   (src/components/views/CalendarView.jsx)
├── MembersView                    (src/components/views/MembersView.jsx)
│   └── InviteMemberModal          (src/components/members/InviteMemberModal.jsx)
├── MyTasksView                    (src/components/views/MyTasksView.jsx)
├── NotificationsView              (src/components/views/NotificationsView.jsx)
├── ReportsView                    (src/components/views/ReportsView.jsx)
├── SettingsView                   (src/components/views/SettingsView.jsx)
│                                   — вкладки: Профиль (фото, имя), Безопасность (пароль)
├── AdminView                      (src/components/views/AdminView.jsx) — только для is_admin;
│                                   KPI-ряд, поиск, сегментированный фильтр,
│                                   таблица пользователей с поповер-меню действий
├── TaskModal                      (src/components/task/TaskModal.jsx)
│                                   — подзадачи, комментарии (@mention), история событий
└── AddColumnModal                 (src/components/board/AddColumnModal.jsx)
```

**UI-примитивы (`src/components/ui/`):**

- `Avatar` — принимает `initials`, `color` (hex), `avatarUrl` (data URL), `size` (xs/sm/md/lg/xl); при avatarUrl рендерит `<img>`, иначе инициалы на цветном фоне.
- `AvatarGroup` — группа аватаров с +N для overflow.
- `Badge` — `Tag` (цвет по имени), `PriorityBadge`.
- `PriorityIcon` — иконка приоритета; экспортирует `PRIORITIES`.
- `TaskTypeIcon` — иконка Lucide + цвет; экспортирует `TASK_TYPES`.
- `ConfirmDialog` — модал с AlertTriangle, клавиша Escape, проп `danger`, `hideCancel`.
- `Toast` — фиксированный снизу по центру, автодисмисс 5с.
- `EmptyState` — иконка + заголовок + подсказка.
- `LoadingScreen` — градиент + анимированный текст.

**Утилиты и хелперы:**

- `src/utils/date.js` — `formatDate(dateStr)`, `formatRange(start, end)`, `isOverdue(dateStr)`.
- `src/utils/recents.js` — `getRecents()`, `addRecent(item)`, `clearRecents()` (localStorage, последние 6 открытых сущностей).
- `src/lib/permissions.js` — хук `usePermissions(projectId?)`: возвращает объект `perms` с предикатами `canManageProject`, `canManageMembers`, `canManageBoards`, `canEditTasks`, `canComment`, `canBeAssignee`, `canView`. Используется в компонентах для условного рендера кнопок.
- `src/store/nanoid.js` — генерация nanoid для временных ID.

### Tailwind v4

Конфиг в `src/index.css`: `@theme {}` со шкалами `primary-*` (синий) и `surface-*` (серый). `@keyframes slide-in-bottom` для Toast. Vite-плагин `@tailwindcss/vite`.

### UI — правила цвета текста

Заголовки секций, подписи колонок таблиц и KPI-лейблы — **всегда `text-fg-primary`** (тёмные, почти чёрные).  
`text-fg-muted` / `text-fg-subtle` — только для вспомогательного мелкого текста (хлебные крошки, временны́е метки, плейсхолдеры).

Примеры правильного применения:

- Заголовки секций в модале задачи (`Подзадачи`, `Комментарии`, `Активность`) — `text-fg-primary`
- Заголовки колонок таблицы (`Задача`, `Приоритет`, `Срок`) — `text-fg-primary`
- KPI-лейблы (`Просрочено`, `Сегодня`, `Активных`) — `text-fg-primary`
- `SectionCaption` в WorkspaceView (`Проекты`, `Ожидают приглашение`) — `text-fg-primary`
- KPI-счётчики `Total` в WorkspaceView (лейблы `Проекты`, `Мои задачи`) — `text-fg-primary`
- Хлебная крошка под названием задачи (`Проект · Доска`) — `text-fg-subtle`
- Надпись-категория над заголовком страницы (`Рабочее пространство` в MyTasksView) — `text-fg-muted`
- Время комментария — `text-fg-muted`

## Форма задачи

```js
{
  id, columnId, title, description,
  priority: 'low'|'medium'|'high',
  type: 'task'|'bug'|'feature'|'improvement',
  completed: bool,
  completedAt: string|null,   // ISO datetime; backfilled из task_events
  tags: string[],
  assignees: string[],        // user ID-ы
  startDate: 'YYYY-MM-DD'|null,
  dueDate: 'YYYY-MM-DD'|null,
  columnTitle: string,        // денормализованное имя колонки
  subtasks: [{ id, title, completed, position }],
  comments: [{ id, userId, author, authorColor, authorInitials, text, time, createdAt }]
}
```

## Форма события задачи (TaskEvent)

```js
{
  id, taskId, userId, userName, userColor, userInitials,
  type, payload: object, createdAt, time,
  // type: 'created'|'title_changed'|'description_changed'|'priority_changed'|
  //       'type_changed'|'start_date_changed'|'due_date_changed'|'completed_changed'|
  //       'moved'|'assignee_added'|'assignee_removed'|'tag_added'|'tag_removed'|
  //       'archived'|'restored'
}
```

## Форма элемента ленты (FeedItem)

TaskEvent + контекст (task/board/project) — отдаётся `GET /api/feed` для рендера WorkspaceView без N+1:

```js
{
  id, taskId, taskTitle,
  boardId, boardName,
  projectId, projectName,
  userId, userName, userColor, userInitials,
  type, payload: object, createdAt, time
}
```

## Форма настроек доски (BoardSettings)

```js
{
  autoMoveOnComplete: bool,   // переносить выполненные в целевую колонку
  autoMoveColumnId:   string, // ID колонки; пусто = «последняя колонка»
  autoArchiveEnabled: bool,
  autoArchiveDays:    number  // дефолт 7
}
```

## Форма участника

```js
{
  id, email, name, color, avatarUrl, initials,
  role: 'admin'|'manager'|'executor'|'observer',
  status: 'pending'|'accepted'
}
```

Иерархия ролей (убывает): `admin` > `manager` > `executor` > `observer`.

- `admin` — полное управление проектом, может управлять всеми ролями
- `manager` — управление досками, колонками, задачами; приглашение участников
- `executor` — создание/редактирование задач, комментарии
- `observer` — только просмотр

## Форма уведомления

```js
{
  id,
  type: 'invite'|'assigned'|'commented'|'mentioned'|'role_changed',
  title: string,
  read: bool,
  projectId?: string,   // для invite, role_changed
  invitedBy?: string,   // ID пригласившего (для invite)
  taskId?: string,      // для assigned/commented/mentioned
  boardId?: string,     // для assigned/commented/mentioned
  actorId?: string,     // кто совершил действие (для commented/mentioned/role_changed)
  createdAt: string
}
```

Список уведомлений (`GET /api/notifications?before=<createdAt>`) возвращает `{ items, hasMore }` — курсорная пагинация по `createdAt`.

## Переменные окружения

| Переменная     | Дефолт                                                                               | Описание                      |
| -------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| `DATABASE_URL` | `host=localhost port=5432 user=postgres password=1234 dbname=kanban sslmode=disable` | Postgres DSN                  |
| `JWT_SECRET`   | `dev-secret-change-in-production`                                                    | Ключ подписи HS256            |
| `CORS_ORIGIN`  | `http://localhost:5173`                                                              | Разрешённый origin фронтенда  |
| `PORT`         | `8080`                                                                               | Порт бэкенда                  |
| `VITE_API_URL` | `http://localhost:8080`                                                              | Базовый URL API для фронтенда |
