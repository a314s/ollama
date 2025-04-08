package documents

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/ollama/ollama/api"
)

// Processor handles document processing and storage
type Processor struct {
	docsPath        string
	vectorStorePath string
	mutex           sync.RWMutex
}

// NewProcessor creates a new document processor
func NewProcessor(docsPath, vectorStorePath string) *Processor {
	// Ensure directories exist
	os.MkdirAll(docsPath, 0755)
	os.MkdirAll(vectorStorePath, 0755)
	
	return &Processor{
		docsPath:        docsPath,
		vectorStorePath: vectorStorePath,
	}
}

// GetDocsPath returns the document storage path
func (p *Processor) GetDocsPath() string {
	return p.docsPath
}

// GetVectorStorePath returns the vector store path
func (p *Processor) GetVectorStorePath() string {
	return p.vectorStorePath
}

// ProcessDocument processes a document and extracts its content and metadata
func (p *Processor) ProcessDocument(ctx context.Context, filePath string) (*api.Document, error) {
	// Check if file exists
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to access file: %w", err)
	}
	
	// Read file content
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	
	// Create document ID from content hash
	docID := generateDocumentID(content)
	
	// Extract file metadata
	metadata := extractMetadata(filePath, fileInfo, content)
	
	// Analyze document content
	analysis, err := analyzeDocument(string(content))
	if err != nil {
		return nil, fmt.Errorf("failed to analyze document: %w", err)
	}
	
	// Generate chunks
	chunks, err := generateChunks(docID, string(content))
	if err != nil {
		return nil, fmt.Errorf("failed to generate chunks: %w", err)
	}
	
	// Create document object
	document := &api.Document{
		ID:       docID,
		Metadata: metadata,
		Analysis: analysis,
		Chunks:   chunks,
	}
	
	// Store document
	if err := p.storeDocument(document); err != nil {
		return nil, fmt.Errorf("failed to store document: %w", err)
	}
	
	// Generate and store embeddings
	if err := p.generateAndStoreEmbeddings(document); err != nil {
		return nil, fmt.Errorf("failed to generate embeddings: %w", err)
	}
	
	return document, nil
}

// GetDocument retrieves a document by ID
func (p *Processor) GetDocument(ctx context.Context, docID string) (*api.Document, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	
	docPath := filepath.Join(p.docsPath, docID+".json")
	
	// Check if document exists
	if _, err := os.Stat(docPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("document not found: %s", docID)
	}
	
	// Read document JSON
	docBytes, err := os.ReadFile(docPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read document: %w", err)
	}
	
	// Parse document
	var doc api.Document
	if err := json.Unmarshal(docBytes, &doc); err != nil {
		return nil, fmt.Errorf("failed to parse document: %w", err)
	}
	
	return &doc, nil
}

// GetAllDocuments retrieves all documents
func (p *Processor) GetAllDocuments(ctx context.Context) ([]*api.Document, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	
	var documents []*api.Document
	
	// List all document files
	files, err := filepath.Glob(filepath.Join(p.docsPath, "*.json"))
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	
	// Read each document
	for _, file := range files {
		// Read document JSON
		docBytes, err := os.ReadFile(file)
		if err != nil {
			// Skip failed document
			continue
		}
		
		// Parse document
		var doc api.Document
		if err := json.Unmarshal(docBytes, &doc); err != nil {
			// Skip failed document
			continue
		}
		
		documents = append(documents, &doc)
	}
	
	return documents, nil
}

// DeleteDocument deletes a document by ID
func (p *Processor) DeleteDocument(ctx context.Context, docID string) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	
	docPath := filepath.Join(p.docsPath, docID+".json")
	
	// Check if document exists
	if _, err := os.Stat(docPath); os.IsNotExist(err) {
		return fmt.Errorf("document not found: %s", docID)
	}
	
	// Delete document file
	if err := os.Remove(docPath); err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}
	
	// Delete embeddings
	embeddingsPath := filepath.Join(p.vectorStorePath, docID+".embeddings")
	if _, err := os.Stat(embeddingsPath); err == nil {
		if err := os.Remove(embeddingsPath); err != nil {
			// Log error but continue
			fmt.Printf("Warning: failed to delete embeddings: %v\n", err)
		}
	}
	
	return nil
}

// SearchDocuments searches for documents matching a query
func (p *Processor) SearchDocuments(ctx context.Context, query string, limit int) ([]*api.DocumentMatch, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	
	// Get all documents
	documents, err := p.GetAllDocuments(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get documents: %w", err)
	}
	
	// Generate query embedding
	queryEmbedding := generateEmbedding(query)
	
	// Search through document chunks
	var matches []*api.DocumentMatch
	
	for _, doc := range documents {
		// Get document embeddings
		embeddings, err := p.getDocumentEmbeddings(doc.ID)
		if err != nil {
			// Skip this document
			continue
		}
		
		// Check each chunk
		for i, chunk := range doc.Chunks {
			if i >= len(embeddings) {
				break
			}
			
			// Calculate similarity
			similarity := cosineSimilarity(queryEmbedding, embeddings[i])
			
			// Add to results if similarity is high enough
			if similarity > 0.5 {
				match := &api.DocumentMatch{
					DocumentID:   doc.ID,
					ChunkID:      chunk.ID,
					ChunkIndex:   i,
					Content:      chunk.Content,
					Similarity:   similarity,
					DocumentName: doc.Metadata.Filename,
				}
				
				matches = append(matches, match)
			}
		}
	}
	
	// Sort matches by similarity (highest first)
	sortMatches(matches)
	
	// Limit results
	if limit > 0 && len(matches) > limit {
		matches = matches[:limit]
	}
	
	return matches, nil
}

// sortMatches sorts matches by similarity in descending order
func sortMatches(matches []*api.DocumentMatch) {
	// Simple bubble sort for now, can be optimized later
	for i := 0; i < len(matches); i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[i].Similarity < matches[j].Similarity {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}
}

// storeDocument saves a document to disk
func (p *Processor) storeDocument(doc *api.Document) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	
	// Convert document to JSON
	docJSON, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("failed to encode document: %w", err)
	}
	
	// Save document
	docPath := filepath.Join(p.docsPath, doc.ID+".json")
	if err := os.WriteFile(docPath, docJSON, 0644); err != nil {
		return fmt.Errorf("failed to save document: %w", err)
	}
	
	return nil
}

// generateAndStoreEmbeddings generates and stores embeddings for a document
func (p *Processor) generateAndStoreEmbeddings(doc *api.Document) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	
	var embeddings [][]float64
	
	// Generate embeddings for each chunk
	for _, chunk := range doc.Chunks {
		embedding := generateEmbedding(chunk.Content)
		embeddings = append(embeddings, embedding)
	}
	
	// Encode embeddings
	embeddingsJSON, err := json.Marshal(embeddings)
	if err != nil {
		return fmt.Errorf("failed to encode embeddings: %w", err)
	}
	
	// Save embeddings
	embeddingsPath := filepath.Join(p.vectorStorePath, doc.ID+".embeddings")
	if err := os.WriteFile(embeddingsPath, embeddingsJSON, 0644); err != nil {
		return fmt.Errorf("failed to save embeddings: %w", err)
	}
	
	return nil
}

// getDocumentEmbeddings retrieves embeddings for a document
func (p *Processor) getDocumentEmbeddings(docID string) ([][]float64, error) {
	embeddingsPath := filepath.Join(p.vectorStorePath, docID+".embeddings")
	
	// Check if embeddings exist
	if _, err := os.Stat(embeddingsPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("embeddings not found for document: %s", docID)
	}
	
	// Read embeddings
	embeddingsBytes, err := os.ReadFile(embeddingsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read embeddings: %w", err)
	}
	
	// Parse embeddings
	var embeddings [][]float64
	if err := json.Unmarshal(embeddingsBytes, &embeddings); err != nil {
		return nil, fmt.Errorf("failed to parse embeddings: %w", err)
	}
	
	return embeddings, nil
}

// generateDocumentID generates a unique ID for a document
func generateDocumentID(content []byte) string {
	// Create SHA-256 hash
	hash := sha256.Sum256(content)
	return fmt.Sprintf("%x", hash)[:16] // Use first 16 chars of the hex hash
}

// extractMetadata extracts metadata from a file
func extractMetadata(filePath string, fileInfo os.FileInfo, content []byte) *api.DocumentMetadata {
	// Get basic file info
	filename := filepath.Base(filePath)
	fileExt := strings.ToLower(filepath.Ext(filePath))
	fileSize := fileInfo.Size()
	modTime := fileInfo.ModTime()
	
	// Determine file type
	fileType := determineFileType(fileExt)
	
	// Extract word count
	wordCount := countWords(string(content))
	
	// Estimate page count (very rough estimate: ~250 words per page)
	estimatedPages := int(math.Ceil(float64(wordCount) / 250.0))
	
	// Generate summary (first few sentences, up to 200 chars)
	summary := generateSummary(string(content), 200)
	
	return &api.DocumentMetadata{
		Filename:       filename,
		Filetype:       fileType,
		FileSize:       fileSize,
		OriginalPath:   filePath,
		UploadDate:     time.Now(),
		ModifiedDate:   modTime,
		WordCount:      wordCount,
		EstimatedPages: estimatedPages,
		Summary:        summary,
	}
}

// determineFileType determines the file type from extension
func determineFileType(fileExt string) string {
	switch fileExt {
	case ".pdf":
		return "PDF Document"
	case ".docx", ".doc":
		return "Word Document"
	case ".xlsx", ".xls":
		return "Excel Spreadsheet"
	case ".pptx", ".ppt":
		return "PowerPoint Presentation"
	case ".txt":
		return "Text Document"
	case ".md":
		return "Markdown Document"
	case ".json":
		return "JSON Document"
	case ".html", ".htm":
		return "HTML Document"
	default:
		return "Unknown Document Type"
	}
}

// countWords counts the number of words in a text
func countWords(text string) int {
	words := strings.Fields(text)
	return len(words)
}

// generateSummary generates a brief summary of the document
func generateSummary(text string, maxLength int) string {
	// Split into sentences (simple approach)
	sentences := splitSentences(text)
	
	// Use the first few sentences as summary
	var summary strings.Builder
	for _, sentence := range sentences {
		if summary.Len()+len(sentence)+1 > maxLength {
			break
		}
		summary.WriteString(sentence)
		summary.WriteString(" ")
	}
	
	// Trim and ensure it doesn't exceed max length
	result := strings.TrimSpace(summary.String())
	if len(result) > maxLength {
		result = result[:maxLength]
	}
	
	return result
}

// splitSentences splits text into sentences (simple implementation)
func splitSentences(text string) []string {
	// Replace common abbreviations to prevent false sentence breaks
	text = regexp.MustCompile(`(Mr\.|Mrs\.|Dr\.|etc\.|i\.e\.|e\.g\.)`).ReplaceAllStringFunc(text, func(m string) string {
		return strings.ReplaceAll(m, ".", "<DOT>")
	})
	
	// Split on sentence endings
	parts := regexp.MustCompile(`[.!?]+`).Split(text, -1)
	
	// Restore dots and clean up
	var sentences []string
	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			continue
		}
		part = strings.ReplaceAll(part, "<DOT>", ".")
		sentences = append(sentences, strings.TrimSpace(part))
	}
	
	return sentences
}

// analyzeDocument performs comprehensive document analysis
func analyzeDocument(text string) (*api.DocumentAnalysis, error) {
	// Extract sections
	sections := extractSections(text)
	
	// Generate table of contents
	toc := generateTableOfContents(sections)
	
	// Extract entities
	entities := extractEntities(text)
	
	// Extract topics
	topics := extractTopics(text)
	
	return &api.DocumentAnalysis{
		Sections:        sections,
		TableOfContents: toc,
		Entities:        entities,
		Topics:          topics,
	}, nil
}

// extractSections extracts sections from document text
func extractSections(text string) []*api.DocumentSection {
	var sections []*api.DocumentSection
	
	// Split by markdown-style headings
	headingPattern := regexp.MustCompile(`(?m)^(#{1,6})\s+(.+)$`)
	matches := headingPattern.FindAllStringSubmatchIndex(text, -1)
	
	if len(matches) == 0 {
		// No headings found, treat the whole document as one section
		sections = append(sections, &api.DocumentSection{
			ID:      fmt.Sprintf("section-%d", 0),
			Index:   0,
			Heading: "",
			Level:   0,
			Content: text,
		})
		return sections
	}
	
	// Process each section
	for i, match := range matches {
		level := len(text[match[2]:match[3]])
		heading := text[match[4]:match[5]]
		
		// Determine section content
		var content string
		startPos := match[1] // End of the heading line
		endPos := len(text)
		
		if i < len(matches)-1 {
			endPos = matches[i+1][0] // Start of the next heading
		}
		
		content = text[startPos:endPos]
		
		// Create section
		section := &api.DocumentSection{
			ID:      fmt.Sprintf("section-%d", i),
			Index:   i,
			Heading: heading,
			Level:   level,
			Content: strings.TrimSpace(content),
		}
		
		sections = append(sections, section)
	}
	
	return sections
}

// generateTableOfContents generates TOC from sections
func generateTableOfContents(sections []*api.DocumentSection) []*api.TOCEntry {
	var toc []*api.TOCEntry
	
	for i, section := range sections {
		entry := &api.TOCEntry{
			Title:        section.Heading,
			Level:        section.Level,
			SectionID:    section.ID,
			SectionIndex: i,
		}
		
		toc = append(toc, entry)
	}
	
	return toc
}

// extractEntities extracts entities from text
func extractEntities(text string) map[string][]api.Entity {
	entities := make(map[string][]api.Entity)
	
	// Extract emails
	emailPattern := regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`)
	emailMatches := emailPattern.FindAllString(text, -1)
	
	var emails []api.Entity
	for _, match := range emailMatches {
		emails = append(emails, api.Entity{
			Text: match,
			Type: "email",
		})
	}
	
	if len(emails) > 0 {
		entities["emails"] = emails
	}
	
	// Extract URLs
	urlPattern := regexp.MustCompile(`https?://[^\s]+`)
	urlMatches := urlPattern.FindAllString(text, -1)
	
	var urls []api.Entity
	for _, match := range urlMatches {
		urls = append(urls, api.Entity{
			Text: match,
			Type: "url",
		})
	}
	
	if len(urls) > 0 {
		entities["urls"] = urls
	}
	
	// Extract dates (simple pattern)
	datePattern := regexp.MustCompile(`\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b`)
	dateMatches := datePattern.FindAllString(text, -1)
	
	var dates []api.Entity
	for _, match := range dateMatches {
		dates = append(dates, api.Entity{
			Text: match,
			Type: "date",
		})
	}
	
	if len(dates) > 0 {
		entities["dates"] = dates
	}
	
	return entities
}

// extractTopics extracts main topics from the document
func extractTopics(text string) []string {
	// Get all words
	words := strings.Fields(text)
	
	// Count word frequencies (excluding common words)
	wordCounts := make(map[string]int)
	commonWords := map[string]bool{
		"the": true, "and": true, "a": true, "to": true, "of": true,
		"in": true, "is": true, "it": true, "that": true, "for": true,
		"on": true, "with": true, "as": true, "this": true, "by": true,
		"be": true, "or": true, "not": true, "an": true, "are": true,
		"was": true, "were": true, "from": true, "at": true, "have": true,
		"has": true, "had": true, "but": true, "what": true, "when": true,
		"why": true, "how": true, "all": true, "if": true, "you": true,
		"his": true, "her": true, "they": true, "we": true, "she": true,
		"he": true, "my": true, "their": true, "your": true, "its": true,
	}
	
	for _, word := range words {
		word = strings.ToLower(strings.Trim(word, ".,;:!?\"'()[]{}"))
		if word == "" || len(word) <= 2 || commonWords[word] {
			continue
		}
		wordCounts[word]++
	}
	
	// Find the most frequent words
	type wordFreq struct {
		word  string
		count int
	}
	
	var wordFreqs []wordFreq
	for word, count := range wordCounts {
		if count >= 3 { // Only consider words that appear at least 3 times
			wordFreqs = append(wordFreqs, wordFreq{word, count})
		}
	}
	
	// Sort by frequency (descending)
	for i := 0; i < len(wordFreqs); i++ {
		for j := i + 1; j < len(wordFreqs); j++ {
			if wordFreqs[i].count < wordFreqs[j].count {
				wordFreqs[i], wordFreqs[j] = wordFreqs[j], wordFreqs[i]
			}
		}
	}
	
	// Take top N words as topics
	var topics []string
	maxTopics := 10
	for i := 0; i < len(wordFreqs) && i < maxTopics; i++ {
		topics = append(topics, wordFreqs[i].word)
	}
	
	return topics
}

// generateChunks splits document into chunks for searching
func generateChunks(docID string, text string) ([]*api.DocumentChunk, error) {
	var chunks []*api.DocumentChunk
	
	// Parameters for chunking
	chunkSize := 1000 // characters
	chunkOverlap := 200
	
	// Split into chunks with overlap
	textLen := len(text)
	
	for start := 0; start < textLen; start += chunkSize - chunkOverlap {
		// Calculate end position
		end := start + chunkSize
		if end > textLen {
			end = textLen
		}
		
		// Extract chunk content
		chunkContent := text[start:end]
		
		// Create chunk
		chunkID := fmt.Sprintf("%s-chunk-%d", docID, len(chunks))
		chunk := &api.DocumentChunk{
			ID:       chunkID,
			DocID:    docID,
			Index:    len(chunks),
			StartPos: start,
			Length:   end - start,
			Content:  chunkContent,
		}
		
		chunks = append(chunks, chunk)
		
		// If we reached the end of the text, stop
		if end >= textLen {
			break
		}
	}
	
	return chunks, nil
}

// generateEmbedding generates a vector embedding for a text using hash-based approach
func generateEmbedding(text string) []float64 {
	// Normalize text
	text = strings.ToLower(text)
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	
	// Hash the text
	hash := sha256.New()
	io.WriteString(hash, text)
	hashBytes := hash.Sum(nil)
	
	// Convert hash to embedding vector (128 dimensions)
	dimensions := 128
	embedding := make([]float64, dimensions)
	
	// Use hash bytes to generate vector values
	for i := 0; i < dimensions; i++ {
		// Use modulo to get a value from hash
		hashIndex := i % len(hashBytes)
		
		// Convert byte to float between -1 and 1
		value := float64(hashBytes[hashIndex])/128.0 - 1.0
		
		embedding[i] = value
	}
	
	// Normalize vector to unit length
	embedding = normalizeVector(embedding)
	
	return embedding
}

// normalizeVector normalizes a vector to unit length
func normalizeVector(vector []float64) []float64 {
	// Calculate magnitude
	var sumSquares float64
	for _, v := range vector {
		sumSquares += v * v
	}
	magnitude := math.Sqrt(sumSquares)
	
	// Avoid division by zero
	if magnitude == 0 {
		return vector
	}
	
	// Normalize
	normalized := make([]float64, len(vector))
	for i, v := range vector {
		normalized[i] = v / magnitude
	}
	
	return normalized
}

// cosineSimilarity calculates the cosine similarity between two vectors
func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0
	}
	
	var dotProduct, magnitudeA, magnitudeB float64
	
	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		magnitudeA += a[i] * a[i]
		magnitudeB += b[i] * b[i]
	}
	
	magnitudeA = math.Sqrt(magnitudeA)
	magnitudeB = math.Sqrt(magnitudeB)
	
	if magnitudeA == 0 || magnitudeB == 0 {
		return 0
	}
	
	return dotProduct / (magnitudeA * magnitudeB)
}
