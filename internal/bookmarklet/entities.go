package bookmarklet

type Meta struct {
	Env map[string]string

	ShortTitle          string   `json:"short_title"`
	Title               string   `json:"title"`
	HeaderSubtext       string   `json:"header_subtext"`
	BookmarkletLinkText string   `json:"bookmarklet_link_text"`
	IncludeInstructions bool     `json:"include_instructions"`
	CustomInstructions  []string `json:"custom_instructions"`
	Disclaimer          string   `json:"disclaimer"`
}
