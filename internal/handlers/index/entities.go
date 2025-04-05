package index

type Doc struct {
	Routes *[]DocRoute `json:"routes"`
}

type DocRoute struct {
	Title string `json:"title"`
	Path  string `json:"path"`
	Href  string `json:"href"`
}
