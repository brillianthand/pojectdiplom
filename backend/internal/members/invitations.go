package members

// Email-based pending invites have been removed: only registered users can be invited.
// Pending state now lives on project_members.status='pending'.
//
// The old project_invitations table is dropped by migration 0008.
