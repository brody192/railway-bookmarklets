package main

import (
	"cmp"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"

	"main/internal/bookmarklet"
	"main/internal/tools"

	"github.com/brody192/ext/handler"
	"github.com/brody192/logger"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	extmiddleware "github.com/brody192/ext/middleware"
)

func main() {
	var r = chi.NewRouter()

	r.Use(extmiddleware.AutoReply([]string{
		"/favicon.ico",
		"/service-worker.js",
		"/robots.txt",
	}, 404))
	r.Use(extmiddleware.TrustProxy(&extmiddleware.TrustProxyConfig{}))
	r.Use(extmiddleware.Logger(logger.Stdout))
	r.Use(middleware.Recoverer)
	r.Use(middleware.Heartbeat("/health"))
	r.Use(extmiddleware.AddTrailingSlash)
	r.Use(middleware.NoCache)

	handler.FileServer(r, "/assets", os.DirFS(filepath.Join(tools.Cwd, "assets")), false)

	if err := bookmarklet.RegisterFolders(r, tools.MustReadFoldersInDir("bookmarklets")); err != nil {
		logger.Stdout.Error("failed to register bookmarklet folders", logger.ErrAttr(err))
		os.Exit(1)
	}

	r.Get("/template-clone-v2", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/template-clone/", http.StatusMovedPermanently)
	})

	handler.RegisterTrailing(r)

	port := cmp.Or(os.Getenv("PORT"), "3000")

	logger.Stdout.Info("starting server", slog.String("port", port))

	if err := http.ListenAndServe((":" + port), r); err != nil {
		logger.Stderr.Error("server exited with an error", logger.ErrAttr(err))
	}
}
