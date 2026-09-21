package handler

import (
	"log/slog"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/gin-gonic/gin"
)

// Deps defines the dependencies required to assemble the Gin HTTP router.
type Deps struct {
	Cfg            *config.Config
	Logger         *slog.Logger
	Pinger         Pinger
	TxManager      TxRunner
	AuthService    AuthService
	UserStore      auth.UserStore
	ContactStore   ContactStore
	FamilyRepo     FamilyRepository
	MemberRepo     MemberRepository
	RelationRepo   RelationshipRepository
	KinshipSvc     KinshipService
	ExcelSvc       ExcelService
	FeedSvc        FeedService
	FeedNamer      feed.AuthorNamer
	SocialPostRepo SocialPostRepository
	PushSvc        PushService
}

// NewRouter constructs and configures the Gin engine with all API routes.
func NewRouter(deps Deps) *gin.Engine {
	if deps.Cfg.AppEnv != config.EnvDev {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Global middlewares
	r.Use(RecoveryMiddleware(deps.Logger))
	r.Use(RequestLogger(deps.Logger))
	r.Use(CORSMiddleware(deps.Cfg))
	r.Use(CSRFMiddleware(deps.Cfg))

	// Instantiate handlers
	authH := NewAuthHandler(deps.Cfg, deps.AuthService, deps.ContactStore)
	treeH := NewTreeHandler(deps.TxManager, deps.FamilyRepo, deps.MemberRepo, deps.RelationRepo, deps.SocialPostRepo)
	kinshipH := NewKinshipHandler(deps.KinshipSvc, deps.MemberRepo)
	excelH := NewExcelHandler(deps.ExcelSvc, deps.FamilyRepo)
	feedH := NewFeedHandler(deps.FeedSvc, deps.UserStore, deps.FeedNamer)
	pushH := NewPushHandler(deps.PushSvc)
	healthH := NewHealthHandler(deps.Pinger)

	// Root health check alias
	r.GET("/healthz", healthH.Check)

	// API v1 group
	v1 := r.Group("/api/v1")
	{
		// Health
		v1.GET("/health", healthH.Check)

		// Auth & Identity (Public)
		authGroup := v1.Group("/auth")
		{
			authGroup.GET("/providers", authH.GetProviders)
			authGroup.GET("/:provider/login", authH.Login)
			authGroup.GET("/:provider/callback", authH.Callback)
			authGroup.POST("/email/magic-link", authH.SendMagicLink)
			authGroup.POST("/email/verify", authH.VerifyMagicLink)
			authGroup.POST("/demo", authH.StartDemo)
			authGroup.POST("/logout", authH.Logout)
		}

		// Public Reads (Genealogy, Kinship, Feed)
		v1.GET("/families", treeH.ListFamilies)
		v1.GET("/families/:id/tree", treeH.GetTree)
		v1.GET("/families/:id/export.xlsx", excelH.Export)
		v1.GET("/families/:id/feed", feedH.List)

		v1.GET("/members", treeH.ListMembers)
		v1.GET("/members/:id", treeH.GetMember)

		v1.GET("/kinship", kinshipH.Calculate)

		// Public Account Link Callback (OAuth provider redirects carry no JWT cookie)
		v1.GET("/me/link/:provider/callback", authH.LinkCallback)

		// Protected Routes (Require JWT cookie)
		protected := v1.Group("")
		protected.Use(AuthMiddleware(deps.Cfg, deps.AuthService))
		{
			// Current user profile & account linking
			protected.GET("/me", authH.GetMe)
			protected.GET("/me/link/:provider/start", authH.StartLinkProvider)
			protected.POST("/me/link/:provider/start", authH.StartLinkProvider)
			protected.DELETE("/me/identities/:id", authH.UnlinkIdentity)
			protected.POST("/me/contacts", authH.AddContact)
			protected.POST("/me/contacts/:id/verify", authH.VerifyContact)

			// Genealogy mutations
			protected.POST("/members", treeH.CreateMember)
			protected.PUT("/members/:id", treeH.UpdateMember)
			protected.DELETE("/members/:id", treeH.DeleteMember)

			// Excel import
			protected.POST("/families/:id/import.xlsx", excelH.Import)

			// Feed creation
			protected.POST("/families/:id/feed", feedH.Create)

			// Push subscription
			protected.POST("/push/subscribe", pushH.Subscribe)
			protected.DELETE("/push/subscribe", pushH.Unsubscribe)
		}
	}

	return r
}
