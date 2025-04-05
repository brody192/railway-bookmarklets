package bookmarklet

import (
	"os"

	"github.com/dchest/jsmin"
)

func minifyJSFile(file string) ([]byte, error) {
	jsFile, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}

	minifiedJS, err := jsmin.Minify(jsFile)
	if err != nil {
		return nil, err
	}

	return minifiedJS, nil
}
