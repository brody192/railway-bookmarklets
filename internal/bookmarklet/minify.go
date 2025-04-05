package bookmarklet

import (
	"bytes"
	"fmt"
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

	newlineCount := bytes.Count(minifiedJS, []byte{'\n'})

	// the minified JS should not have any newlines since the js will be placed into a bookmark
	if newlineCount > 0 {
		return nil, fmt.Errorf("found newlines in minified JS: file: %s, newline count: %d", file, newlineCount)
	}

	return minifiedJS, nil
}
