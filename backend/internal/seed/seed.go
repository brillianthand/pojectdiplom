package seed

import (
	"context"
	"database/sql"
	"net/http"

	"kanban/internal/platform/httpx"
)

func Handler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var count int
		db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM projects`).Scan(&count)
		if count > 0 {
			httpx.WriteJSON(w, 200, map[string]string{"status": "already seeded"})
			return
		}

		tx, err := db.BeginTx(r.Context(), nil)
		if err != nil {
			httpx.ErrJSON(w, 500, err.Error())
			return
		}

		var txErr error
		exec := func(q string, args ...any) {
			if txErr != nil {
				return
			}
			_, txErr = tx.Exec(q, args...)
		}

		exec(`INSERT INTO projects (id,name,color,icon,active_board_id) VALUES
			('p1','Product Redesign','#3b64f5','🎨','b1'),
			('p2','Backend API v2','#10b981','⚙️','b3'),
			('p3','Mobile App','#f59e0b','📱','b4'),
			('p4','Marketing Site','#ef4444','🌐','b5')`)

		exec(`INSERT INTO boards (id,project_id,name,position) VALUES
			('b1','p1','Сайт для зоомагазина',0),
			('b2','p1','Фрилансер',1),
			('b3','p2','Sprint 1',0),
			('b4','p3','Main Board',0),
			('b5','p4','Main Board',0)`)

		exec(`INSERT INTO columns (id,board_id,title,color,text_color,position) VALUES
			('col-1','b1','Дизайн','#e0e7ff','#4338ca',0),
			('col-2','b1','Входящие задачи','#ede9fe','#6d28d9',1),
			('col-3','b1','Тестирование','#f0fdf4','#166534',2),
			('col-4','b1','Готово','#f0f9ff','#0369a1',3),
			('col-5','b2','Новые','#fff7ed','#c2410c',0),
			('col-6','b2','В работе','#eff6ff','#1d4ed8',1),
			('col-7','b3','Todo','#f8fafc','#475569',0),
			('col-8','b3','In Progress','#eff6ff','#1d4ed8',1),
			('col-9','b3','Done','#f0fdf4','#166534',2),
			('col-10','b4','Backlog','#f8fafc','#475569',0),
			('col-11','b5','Backlog','#f8fafc','#475569',0)`)

		exec(`INSERT INTO tasks (id,column_id,title,description,priority,type,completed,cover_image,start_date,due_date,position) VALUES
			('t1','col-1','Обложка с котиком','','high','feature',false,'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&q=80','2026-04-29','2026-05-12',0),
			('t2','col-1','Прототип каталога','','medium','task',false,null,'2026-04-29','2026-05-12',1),
			('t3','col-2','Уведомления об изменениях в личном кабинете','','medium','improvement',true,null,null,null,0),
			('t4','col-2','Создание страницы профиля в ЛК','','high','feature',false,null,null,'2026-05-15',1),
			('t5','col-2','Ссылка-приглашение по реферальной программе','','low','task',false,null,null,null,2),
			('t6','col-2','Просмотр товаров в корзине','','medium','task',false,null,null,null,3),
			('t7','col-2','Отрисовка диаграммы "Здоровье вашего питомца"','','high','feature',false,null,null,null,4),
			('t8','col-2','Настройка аватарки в аккаунте','','low','improvement',false,null,null,null,5),
			('t9','col-3','Уведомления о изменении данных на email','','medium','bug',false,null,null,'2026-05-08',0),
			('t10','col-3','Не работает компонент отображения маршрута','','high','bug',false,null,null,'2026-05-06',1),
			('t11','col-3','Bubble chart','','low','task',false,null,null,null,2),
			('t12','col-4','Дизайн главной страницы','','medium','feature',true,null,'2026-04-15','2026-04-28',0),
			('t13','col-4','Настройка CI/CD пайплайна','','high','improvement',true,null,'2026-04-10','2026-04-25',1),
			('t14','col-5','Лендинг для клиента','','medium','task',false,null,null,null,0),
			('t15','col-6','Редизайн логотипа','','high','feature',false,null,'2026-05-01','2026-05-10',0),
			('t16','col-7','Auth service JWT refresh','','high','bug',false,null,null,'2026-05-12',0),
			('t17','col-7','Rate limiting middleware','','medium','task',false,null,null,null,1),
			('t18','col-8','REST API v2 endpoints','','high','feature',false,null,'2026-05-01','2026-05-08',0),
			('t19','col-9','Database schema migration','','high','improvement',true,null,'2026-04-15','2026-04-25',0)`)

		exec(`INSERT INTO task_tags (task_id,tag) VALUES
			('t1','Mobile&Web'),('t4','Mobile'),('t7','Web'),('t9','Web'),
			('t10','critical'),('t10','Web'),('t11','Mobile'),('t12','Web'),
			('t14','Web'),('t16','backend'),('t17','backend'),('t18','api'),('t19','db')`)

		exec(`INSERT INTO task_assignees (task_id,member_id) VALUES
			('t1','AK'),('t2','MB'),('t3','SN'),('t4','AK'),('t4','MB'),
			('t6','KG'),('t7','AK'),('t9','SN'),('t10','MB'),('t10','TL'),
			('t11','AK'),('t12','AK'),('t13','SN'),('t14','KG'),('t15','MB'),
			('t16','SN'),('t18','SN'),('t19','SN')`)

		exec(`INSERT INTO comments (id,task_id,author,text,created_at) VALUES
			('c1','t3','SN','Готово, на ревью', NOW() - INTERVAL '2 hours')`)

		if txErr != nil {
			tx.Rollback()
			httpx.ErrJSON(w, 500, txErr.Error())
			return
		}
		if err := tx.Commit(); err != nil {
			httpx.ErrJSON(w, 500, err.Error())
			return
		}
		httpx.WriteJSON(w, 200, map[string]string{"status": "seeded"})
	}
}

// Run seeds the database programmatically (for tests or CLI usage).
func Run(ctx context.Context, db *sql.DB) error {
	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM projects`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "/api/seed", nil)
	rw := &discardResponseWriter{}
	Handler(db)(rw, req)
	return nil
}

type discardResponseWriter struct{ code int }

func (d *discardResponseWriter) Header() http.Header        { return http.Header{} }
func (d *discardResponseWriter) Write(b []byte) (int, error) { return len(b), nil }
func (d *discardResponseWriter) WriteHeader(code int)        { d.code = code }
