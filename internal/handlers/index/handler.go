package index

import (
	"bytes"
	"html/template"
	"net/http"
	"os"
	"sort"
	"unicode/utf8"

	"github.com/brody192/ext/respond"
	"github.com/brody192/logger"
)

var indexTmpl = template.Must(template.ParseFS(indexHTMLfs, "index.template.html"))

func Handler(doc *Doc) http.HandlerFunc {
	if doc == nil || doc.Routes == nil {
		panic("handler input must not be nil")
	}

	sort.Slice((*doc.Routes), func(i, j int) bool {
		return utf8.RuneCountInString((*doc.Routes)[i].Path) < utf8.RuneCountInString((*doc.Routes)[j].Path)
	})

	var renderedTemplate = &bytes.Buffer{}

	if err := indexTmpl.ExecuteTemplate(renderedTemplate, "index.template.html", doc); err != nil {
		logger.Stderr.Error("failed to execute template", logger.ErrAttr(err))
		os.Exit(1)
	}

	return func(w http.ResponseWriter, _ *http.Request) {
		respond.HTMLBlob(w, renderedTemplate.Bytes(), http.StatusOK)
	}
}
