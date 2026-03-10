package authapi

import authSvc "EnvPilot/internal/auth/service"

type AuthAPI struct {
	svc *authSvc.Service
}

func NewAuthAPI(svc *authSvc.Service) *AuthAPI {
	return &AuthAPI{svc: svc}
}

type UnlockReq struct {
	Password string `json:"password"`
}

type ChangePasswordReq struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (a *AuthAPI) GetStatus() Result[authSvc.Status] {
	return OK(a.svc.GetStatus(""))
}

func (a *AuthAPI) Unlock(req UnlockReq) Result[authSvc.Status] {
	status, err := a.svc.Unlock("", req.Password)
	if err != nil {
		return Fail[authSvc.Status](err.Error())
	}
	return OK(status)
}

func (a *AuthAPI) Setup(req UnlockReq) Result[authSvc.Status] {
	status, err := a.svc.Setup("", req.Password)
	if err != nil {
		return Fail[authSvc.Status](err.Error())
	}
	return OK(status)
}

func (a *AuthAPI) ChangePassword(req ChangePasswordReq) Result[authSvc.Status] {
	status, err := a.svc.ChangePassword("", req.CurrentPassword, req.NewPassword)
	if err != nil {
		return Fail[authSvc.Status](err.Error())
	}
	return OK(status)
}

func (a *AuthAPI) Lock() Result[bool] {
	a.svc.Lock("")
	return OK(true)
}