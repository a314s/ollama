package types

import (
	"encoding/json"
	"time"
)

// DocumentMetadata contains metadata about a document
type DocumentMetadata struct {
	// ID is the unique identifier for the document
	ID string `json:"id"`

	// Filename is the name of the document file
	Filename string `json:"filename"`

	// Filetype is the type of the document file
	Filetype string `json:"filetype"`

	// Filesize is the size of the document file in bytes
	Filesize int64 `json:"filesize"`

	// OriginalPath is the original path of the document file
	OriginalPath string `json:"original_path"`

	// UploadDate is the date the document was uploaded
	UploadDate time.Time `json:"upload_date"`

	// LastModifiedDate is the date the document was last modified
	LastModifiedDate time.Time `json:"last_modified_date"`

	// ContentSummary is a summary of the document content
	ContentSummary string `json:"content_summary"`

	// Tags are user-defined tags for the document
	Tags []string `json:"tags"`

	// WordCount is the number of words in the document
	WordCount int `json:"word_count"`

	// PageCount is the estimated number of pages
	PageCount int `json:"page_count"`
}

// Marshal serializes the DocumentMetadata to JSON
func (m *DocumentMetadata) Marshal() ([]byte, error) {
	return json.Marshal(m)
}

// Unmarshal deserializes the DocumentMetadata from JSON
func (m *DocumentMetadata) Unmarshal(data []byte) error {
	return json.Unmarshal(data, m)
}

// DocumentSection represents a section in a document
type DocumentSection struct {
	// Index is the index of the section
	Index int `json:"index"`

	// Heading is the heading of the section
	Heading string `json:"heading"`

	// HeadingLevel is the level of the heading
	HeadingLevel int `json:"heading_level"`

	// Content is the content of the section
	Content string `json:"content"`

	// StartPosition is the position of the start of the section
	StartPosition int `json:"start_position"`

	// Length is the length of the section
	Length int `json:"length"`
}

// Marshal serializes the DocumentSection to JSON
func (s *DocumentSection) Marshal() ([]byte, error) {
	return json.Marshal(s)
}

// Unmarshal deserializes the DocumentSection from JSON
func (s *DocumentSection) Unmarshal(data []byte) error {
	return json.Unmarshal(data, s)
}

// DocumentEntity represents an entity extracted from a document
type DocumentEntity struct {
	// Type is the type of the entity
	Type string `json:"type"`

	// Value is the value of the entity
	Value string `json:"value"`

	// Position is the position of the entity in the document
	Position int `json:"position"`
}

// Marshal serializes the DocumentEntity to JSON
func (e *DocumentEntity) Marshal() ([]byte, error) {
	return json.Marshal(e)
}

// Unmarshal deserializes the DocumentEntity from JSON
func (e *DocumentEntity) Unmarshal(data []byte) error {
	return json.Unmarshal(data, e)
}

// DocumentTopic represents a topic extracted from a document
type DocumentTopic struct {
	// Name is the name of the topic
	Name string `json:"name"`

	// Weight is the weight of the topic (0-1)
	Weight float64 `json:"weight"`

	// Keywords are related keywords for the topic
	Keywords []string `json:"keywords"`
}

// Marshal serializes the DocumentTopic to JSON
func (t *DocumentTopic) Marshal() ([]byte, error) {
	return json.Marshal(t)
}

// Unmarshal deserializes the DocumentTopic from JSON
func (t *DocumentTopic) Unmarshal(data []byte) error {
	return json.Unmarshal(data, t)
}

// TOCEntry represents an entry in a table of contents
type TOCEntry struct {
	// Level is the level of the entry
	Level int `json:"level"`

	// Title is the title of the entry
	Title string `json:"title"`

	// Position is the position of the entry in the document
	Position int `json:"position"`
}

// Marshal serializes the TOCEntry to JSON
func (e *TOCEntry) Marshal() ([]byte, error) {
	return json.Marshal(e)
}

// Unmarshal deserializes the TOCEntry from JSON
func (e *TOCEntry) Unmarshal(data []byte) error {
	return json.Unmarshal(data, e)
}

// DocumentAnalysis contains analysis of a document
type DocumentAnalysis struct {
	// ID is the unique identifier for the document
	ID string `json:"id"`

	// Sections are the sections of the document
	Sections []DocumentSection `json:"sections"`

	// Entities are entities extracted from the document
	Entities []DocumentEntity `json:"entities"`

	// Topics are topics extracted from the document
	Topics []DocumentTopic `json:"topics"`

	// TableOfContents is the table of contents for the document
	TableOfContents []TOCEntry `json:"table_of_contents"`

	// AnalyzedAt is the time the document was analyzed
	AnalyzedAt time.Time `json:"analyzed_at"`

	// WordCount is the number of words in the document
	WordCount int `json:"word_count"`

	// PageCount is the estimated number of pages
	PageCount int `json:"page_count"`
}

// Marshal serializes the DocumentAnalysis to JSON
func (a *DocumentAnalysis) Marshal() ([]byte, error) {
	return json.Marshal(a)
}

// Unmarshal deserializes the DocumentAnalysis from JSON
func (a *DocumentAnalysis) Unmarshal(data []byte) error {
	return json.Unmarshal(data, a)
}

// DocumentChunk represents a chunk of a document for embedding and retrieval
type DocumentChunk struct {
	// ID is the unique identifier for the chunk
	ID string `json:"id"`

	// DocumentID is the ID of the document the chunk belongs to
	DocumentID string `json:"document_id"`

	// ChunkIndex is the index of the chunk
	ChunkIndex int `json:"chunk_index"`

	// Content is the content of the chunk
	Content string `json:"content"`

	// StartPosition is the position of the start of the chunk
	StartPosition int `json:"start_position"`

	// Length is the length of the chunk
	Length int `json:"length"`

	// EndPosition is the position of the end of the chunk
	EndPosition int `json:"end_position"`

	// Preview is a preview of the chunk content
	Preview string `json:"preview"`

	// Embedding is the embedding vector for the chunk
	Embedding []float64 `json:"embedding"`
}

// Marshal serializes the DocumentChunk to JSON
func (c *DocumentChunk) Marshal() ([]byte, error) {
	return json.Marshal(c)
}

// Unmarshal deserializes the DocumentChunk from JSON
func (c *DocumentChunk) Unmarshal(data []byte) error {
	return json.Unmarshal(data, c)
}

// Document represents a processed document
type Document struct {
	// ID is the unique identifier for the document
	ID string `json:"id"`

	// Metadata is the metadata for the document
	Metadata *DocumentMetadata `json:"metadata"`

	// Analysis is the analysis of the document
	Analysis *DocumentAnalysis `json:"analysis"`

	// Chunks are the chunks of the document
	Chunks []*DocumentChunk `json:"chunks"`

	// Path is the path to the document file
	Path string `json:"path"`
}

// Marshal serializes the Document to JSON
func (d *Document) Marshal() ([]byte, error) {
	return json.Marshal(d)
}

// Unmarshal deserializes the Document from JSON
func (d *Document) Unmarshal(data []byte) error {
	return json.Unmarshal(data, d)
}

// SearchResultMetadata contains additional metadata for search results
type SearchResultMetadata struct {
	// FileType is the document file type
	FileType string `json:"file_type,omitempty"`

	// SemanticScore is the score from semantic search (if applicable)
	SemanticScore *float64 `json:"semantic_score,omitempty"`

	// KeywordScore is the score from keyword search (if applicable)
	KeywordScore *float64 `json:"keyword_score,omitempty"`
	
	// TitleScore is the score based on title match (if applicable)
	TitleScore *float64 `json:"title_score,omitempty"`

	// TopicScore is the score based on topic match (if applicable)
	TopicScore *float64 `json:"topic_score,omitempty"`

	// TopicList is the list of matched topics (if applicable)
	TopicList []string `json:"topic_list,omitempty"`

	// MatchContext provides context around the match
	MatchContext string `json:"match_context,omitempty"`
}


// DocumentMatch represents a match for a document search
type DocumentMatch struct {
	// DocumentID is the ID of the matching document
	DocumentID string `json:"document_id"`

	// ChunkID is the ID of the matching chunk
	ChunkID string `json:"chunk_id"`

	// ChunkIndex is the index of the chunk in the document
	ChunkIndex int `json:"chunk_index"`

	// Content is the content of the matching chunk (may include preview with context)
	Content string `json:"content"`

	// RawContent is the original unformatted content of the chunk
	RawContent string `json:"raw_content,omitempty"`

	// Similarity is the overall similarity score (0-1)
	Similarity float64 `json:"similarity"`

	// DocumentName is the name of the document
	DocumentName string `json:"document_name"`

	// Metadata contains additional search result metadata
	Metadata *SearchResultMetadata `json:"metadata,omitempty"`
}
