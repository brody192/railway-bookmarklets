package tools

import (
	"os"
	"path/filepath"
	"strings"
)

var (
	Cwd = mustCwd()

	Env = EnvToMap()
)

func EnvToMap() map[string]string {
	env := make(map[string]string)

	for i := range os.Environ() {
		keyValue := strings.SplitN(os.Environ()[i], "=", 2)

		if len(keyValue) != 2 {
			panic("malformed key value pair: " + os.Environ()[i])
		}

		env[keyValue[0]] = keyValue[1]
	}

	return env
}

func mustCwd() string {
	dir, err := os.Getwd()
	if err != nil {
		panic(err)
	}

	return dir
}

func MustReadFoldersInDir(name string) []string {
	dir, err := os.ReadDir(name)
	if err != nil {
		panic(err)
	}

	var folders []string

	for _, f := range dir {
		if f.IsDir() {
			folders = append(folders, filepath.Join(Cwd, name, f.Name()))
		}
	}

	return folders
}
