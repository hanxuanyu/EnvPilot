package api

import (
	"net/http"
	"time"

	authSvc "EnvPilot/internal/auth/service"
)

type AuthHandler struct {
	svc *authSvc.Service
}

func NewAuthHandler(svc *authSvc.Service) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	writeOK(w, h.svc.GetStatus(sessionIDFromRequest(r)))
}

func (h *AuthHandler) Unlock(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	sessionID, err := ensureSessionID(r, h.svc)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	status, err := h.svc.Unlock(sessionID, req.Password)
	if err != nil {
		writeFail(w, http.StatusForbidden, err.Error())
		return
	}
	setSessionCookie(w, r, sessionID)
	writeOK(w, status)
}

func (h *AuthHandler) Setup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	sessionID, err := ensureSessionID(r, h.svc)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	status, err := h.svc.Setup(sessionID, req.Password)
	if err != nil {
		writeFail(w, http.StatusBadRequest, err.Error())
		return
	}
	setSessionCookie(w, r, sessionID)
	writeOK(w, status)
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	sessionID, err := ensureSessionID(r, h.svc)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	status, err := h.svc.ChangePassword(sessionID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		writeFail(w, http.StatusBadRequest, err.Error())
		return
	}
	setSessionCookie(w, r, sessionID)
	writeOK(w, status)
}

func (h *AuthHandler) Lock(w http.ResponseWriter, r *http.Request) {
	h.svc.Lock(sessionIDFromRequest(r))
	clearSessionCookie(w)
	writeOK(w, true)
}

func sessionIDFromRequest(r *http.Request) string {
	cookie, err := r.Cookie(authSvc.SessionCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func ensureSessionID(r *http.Request, svc *authSvc.Service) (string, error) {
	if existing := sessionIDFromRequest(r); existing != "" {
		return existing, nil
	}
	return svc.NewSessionID()
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     authSvc.SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
		Expires:  time.Now().Add(12 * time.Hour),
		MaxAge:   int((12 * time.Hour).Seconds()),
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     authSvc.SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}