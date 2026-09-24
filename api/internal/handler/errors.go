package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/kinship"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	pushdomain "github.com/dracuten1/cgv-v2/api/internal/push"
	genrepo "github.com/dracuten1/cgv-v2/api/internal/repository/genealogy"
	"github.com/dracuten1/cgv-v2/api/internal/repository/social"
	"github.com/gin-gonic/gin"
)

// respondError maps known domain errors to their HTTP status and Vietnamese model.ErrorEnvelope.
func respondError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	// 1. Auth domain errors
	switch {
	case errors.Is(err, auth.ErrProviderDisabled), errors.Is(err, auth.ErrUnknownProvider):
		c.JSON(http.StatusNotFound, model.NewErrorEnvelope(model.CodeNotFound, err.Error()))
		return
	case errors.Is(err, auth.ErrUserNotFound), errors.Is(err, auth.ErrIdentityNotFound), errors.Is(err, auth.ErrMemberNotFound):
		c.JSON(http.StatusNotFound, model.NewErrorEnvelope(model.CodeNotFound, err.Error()))
		return
	case errors.Is(err, auth.ErrDemoIsolation):
		c.JSON(http.StatusForbidden, model.NewErrorEnvelope(model.CodeDemoIsolationViolation, err.Error()))
		return
	case errors.Is(err, auth.ErrLastIdentity):
		c.JSON(http.StatusConflict, model.NewErrorEnvelope(model.CodeLastIdentityCannotBeRemoved, err.Error()))
		return
	case errors.Is(err, auth.ErrAlreadyLinked), errors.Is(err, auth.ErrMemberAlreadyClaimed):
		c.JSON(http.StatusConflict, model.NewErrorEnvelope(model.CodeConflict, err.Error()))
		return
	case errors.Is(err, auth.ErrInvalidState):
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	case errors.Is(err, auth.ErrInvalidToken), errors.Is(err, auth.ErrTokenUsedOrExpired):
		c.JSON(http.StatusUnauthorized, model.NewErrorEnvelope(model.CodeUnauthorized, err.Error()))
		return
	case errors.Is(err, auth.ErrProviderExchange):
		c.JSON(http.StatusBadGateway, model.NewErrorEnvelope("PROVIDER_EXCHANGE_FAILED", err.Error()))
		return
	}

	// 2. Genealogy domain errors
	switch {
	case errors.Is(err, genrepo.ErrNotFound):
		c.JSON(http.StatusNotFound, model.NewErrorEnvelope(model.CodeNotFound, "Không tìm thấy dữ liệu yêu cầu"))
		return
	case errors.Is(err, genrepo.ErrDuplicate):
		c.JSON(http.StatusConflict, model.NewErrorEnvelope(model.CodeConflict, "Dữ liệu đã tồn tại"))
		return
	case errors.Is(err, kinship.ErrMemberNotFound):
		c.JSON(http.StatusNotFound, model.NewErrorEnvelope(model.CodeNotFound, err.Error()))
		return
	}

	// 3. Feed domain errors
	switch {
	case errors.Is(err, feed.ErrContentRequired),
		errors.Is(err, feed.ErrContentTooLong),
		errors.Is(err, feed.ErrTooManyImages),
		errors.Is(err, feed.ErrInvalidImageURL),
		errors.Is(err, feed.ErrImageURLTooLong),
		errors.Is(err, feed.ErrFamilyIDRequired),
		errors.Is(err, feed.ErrAuthorIDRequired):
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	case errors.Is(err, feed.ErrPostNotFound):
		c.JSON(http.StatusNotFound, model.NewErrorEnvelope(model.CodeNotFound, err.Error()))
		return
	}

	// 4. Push domain errors
	switch {
	case errors.Is(err, pushdomain.ErrEndpointRequired),
		errors.Is(err, pushdomain.ErrInvalidEndpoint),
		errors.Is(err, pushdomain.ErrP256DHRequired),
		errors.Is(err, pushdomain.ErrAuthKeyRequired),
		errors.Is(err, pushdomain.ErrInvalidBase64Key),
		errors.Is(err, pushdomain.ErrUserIDRequired):
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, err.Error()))
		return
	case errors.Is(err, pushdomain.ErrSubscriptionGone), errors.Is(err, socialrepo.ErrNotFound):
		c.JSON(http.StatusNotFound, model.NewErrorEnvelope(model.CodeNotFound, "Không tìm thấy thông tin đăng ký nhận thông báo"))
		return
	}

	// 5. Unhandled / generic server errors
	slog.Error("Lỗi hệ thống chưa được phân loại",
		slog.String("path", c.Request.URL.Path),
		slog.String("error", err.Error()),
	)
	c.JSON(http.StatusInternalServerError, model.NewErrorEnvelope(model.CodeInternalError, "Đã xảy ra lỗi nội bộ hệ thống, vui lòng thử lại sau"))
}
