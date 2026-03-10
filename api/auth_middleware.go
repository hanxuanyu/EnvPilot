package api

import (
	"net/http"

	authSvc "EnvPilot/internal/auth/service"
)

type Authz struct {
	svc *authSvc.Service
}

func NewAuthz(svc *authSvc.Service) *Authz {
	return &Authz{svc: svc}
}

func (a *Authz) RequireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := a.svc.RequireAdmin(sessionIDFromRequest(r)); err != nil {
			writeFail(w, http.StatusForbidden, err.Error())
			return
		}
		next(w, r)
	}
}

func (a *Authz) RequireProtectedPage(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := a.svc.RequireProtectedPage(sessionIDFromRequest(r)); err != nil {
			writeFail(w, http.StatusForbidden, err.Error())
			return
		}
		next(w, r)
	}
}
