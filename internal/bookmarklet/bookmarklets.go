package bookmarklet

import (
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"main/internal/handlers/index"
	"main/internal/tools"

	"github.com/brody192/ext/handler"
	"github.com/brody192/ext/respond"
	"github.com/brody192/ext/variables"
	"github.com/brody192/logger"
	"github.com/go-chi/chi/v5"
	"github.com/spf13/afero"
	"github.com/yalue/merged_fs"
)

var (
	indexTmpl = template.Must(template.ParseFS(indexHTMLfs, "index.template.html"))

	memfs = afero.NewIOFS(afero.NewMemMapFs())

	isDevMode = strings.HasPrefix(os.Getenv("ENV"), "dev")
)

func init() {
	if isDevMode {
		logger.Stdout.Info("running in dev mode", slog.String("info", "unset ENV=dev to run in prod"))
	} else {
		logger.Stderr.Info("running in prod mode", slog.String("info", "set ENV=dev to run in dev"))
	}
}

func RegisterFolders(r chi.Router, folderPaths []string) error {
	var docRoutes []index.DocRoute

	var timeTracker time.Duration

	foundTitles := make(map[string]struct{})

	for _, folderPath := range folderPaths {
		folderBase := filepath.Base(folderPath)

		sT := time.Now()

		meta, err := RegisterFolder(r, folderPath, strings.TrimPrefix(folderBase, "_"))
		if err != nil {
			return err
		}

		if _, ok := foundTitles[meta.ShortTitle]; ok {
			return fmt.Errorf("found duplicate title: %s", meta.ShortTitle)
		}

		foundTitles[meta.ShortTitle] = struct{}{}

		timeTracker += time.Since(sT)

		if strings.HasPrefix(folderBase, "_") {
			continue
		}

		docRoutes = append(docRoutes, index.DocRoute{
			Title: meta.ShortTitle,
			Path:  folderBase,
			Href:  "/" + folderBase + "/",
		})
	}

	logger.Stdout.Info("generated all bookmarklet index pages", slog.String("time_pretty", timeTracker.String()))

	r.Get("/", index.Handler(&index.Doc{
		Routes: &docRoutes,
	}))

	return nil
}

func RegisterFolder(r chi.Router, folderPath, folderBase string) (*Meta, error) {
	bookmarkletMeta := filepath.Join(folderPath, "meta.json")
	bookmarkletJS := filepath.Join(folderPath, "bookmarklet.js")

	for _, path := range []string{folderPath, bookmarkletMeta, bookmarkletJS} {
		if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("path exist check failed: %w", err)
		}
	}

	metaFile, err := os.Open(bookmarkletMeta)
	if err != nil {
		return nil, fmt.Errorf("open bookmarklet meta file failed: %w", err)
	}

	defer metaFile.Close()

	meta := &Meta{}

	if err := json.NewDecoder(metaFile).Decode(&meta); err != nil {
		return nil, fmt.Errorf("decoding bookmarklet meta failed: %w", err)
	}

	if err := memfs.MkdirAll(folderBase, 0o700); err != nil {
		return nil, fmt.Errorf("mkdir failed: %w", err)
	}

	index, err := memfs.OpenFile(filepath.Join(folderBase, "index.html"), os.O_RDWR|os.O_CREATE, 0o700)
	if err != nil {
		return nil, fmt.Errorf("openfile failed to open index.html: %w", err)
	}

	defer index.Close()

	meta.Env = tools.Env

	if err := indexTmpl.ExecuteTemplate(index, "index.template.html", &meta); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	templateFolder, err := memfs.Sub(folderBase)
	if err != nil {
		return nil, fmt.Errorf("error subbing mem fs: %w", err)
	}

	mergedFS := merged_fs.NewMergedFS(templateFolder, os.DirFS(folderPath))

	minifiedJS := []byte{}

	if !isDevMode {
		minifiedJS, err = minifyJSFile(bookmarkletJS)
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrJSMinificationFailed, err)
		}
	}

	r.Route(("/" + folderBase), func(r chi.Router) {

		handler.FileServer(r, "/", mergedFS, false)

		r.Get("/bookmarklet.min.js", func(w http.ResponseWriter, _ *http.Request) {
			if isDevMode {
				minifiedJS, err = minifyJSFile(bookmarkletJS)
				if err != nil {
					logger.Stderr.Error(ErrJSMinificationFailed.Error(), logger.ErrAttr(err))
					http.Error(w, ErrJSMinificationFailed.Error(), http.StatusInternalServerError)
					return
				}
			}

			respond.Blob(w, variables.MIMEApplicationJavaScriptCharsetUTF8, minifiedJS, http.StatusOK)
		})
	})

	return meta, nil
}
