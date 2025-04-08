package documents

import (
	"bufio"
	"bytes"
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
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ollama/ollama/lmstudio/types"
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
func (p *Processor) ProcessDocument(ctx context.Context, filePath string) (*types.Document, error) {
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
	document := &types.Document{
		ID:       docID,
		Metadata: metadata, 
		Analysis: analysis, 
		Chunks:   chunks,   
		Path:     filePath, 
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
func (p *Processor) GetDocument(ctx context.Context, docID string) (*types.Document, error) {
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
	var doc types.Document
	if err := json.Unmarshal(docBytes, &doc); err != nil {
		return nil, fmt.Errorf("failed to parse document: %w", err)
	}
	
	return &doc, nil
}

// GetAllDocuments retrieves all documents
func (p *Processor) GetAllDocuments(ctx context.Context) ([]*types.Document, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	
	var documents []*types.Document
	
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
		var doc types.Document
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
func (p *Processor) SearchDocuments(ctx context.Context, query string, limit int, topics []string) ([]*types.DocumentMatch, error) {
	p.mutex.RLock()
	defer p.mutex.RUnlock()
	
	// Get all documents
	documents, err := p.GetAllDocuments(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get documents: %w", err)
	}
	
	// Filter documents by topics if provided
	if len(topics) > 0 {
		topicMap := make(map[string]bool)
		for _, topic := range topics {
			topicMap[strings.ToLower(topic)] = true
		}

		filteredDocs := []*types.Document{}
		for _, doc := range documents {
			if doc.Analysis != nil { 
				for _, docTopic := range doc.Analysis.Topics {
					if topicMap[strings.ToLower(docTopic.Name)] { 
						filteredDocs = append(filteredDocs, doc)
						break 
					}
				}
			}
		}
		documents = filteredDocs
	}

	var matches []*types.DocumentMatch

	// Perform semantic search if query is provided
	if query != "" {
		// Generate query embedding
		queryEmbedding := generateEmbedding(query)
		
		// Search through document chunks
		var matches []*types.DocumentMatch
		
		// Track which documents we've already matched to avoid duplicates
		matchedDocIds := make(map[string]bool)
		
		// Check for exact keyword matches in document titles and content
		lowercaseQuery := strings.ToLower(query)
		queryWords := strings.Fields(lowercaseQuery)
		
		for _, doc := range documents {
			docAlreadyMatched := false
			
			// Get document embeddings
			embeddings, err := p.getDocumentEmbeddings(doc.ID)
			if err != nil {
				// Skip this document
				continue
			}
			
			// Calculate title match score
			titleMatchScore := 0.0
			if doc.Metadata.Filename != "" {
				lowercaseTitle := strings.ToLower(doc.Metadata.Filename)
				for _, word := range queryWords {
					if strings.Contains(lowercaseTitle, word) {
						titleMatchScore += 0.2 
					}
				}
			}
			
			// Check document topics for matches (keyword matching)
			topicMatchScore := 0.0
			if doc.Analysis != nil && len(doc.Analysis.Topics) > 0 {
				for _, topic := range doc.Analysis.Topics {
					topicLower := strings.ToLower(topic.Name)
					for _, word := range queryWords {
						if strings.Contains(topicLower, word) || strings.Contains(word, topicLower) {
							topicMatchScore += 0.15 
							break
						}
					}
				}
			}
			
			// Check each chunk
			for i, chunk := range doc.Chunks {
				if i >= len(embeddings) {
					break
				}
				
				// Calculate semantic similarity
				semanticScore := cosineSimilarity(queryEmbedding, embeddings[i])
				
				// Calculate keyword match score
				keywordScore := 0.0
				if chunk.Content != "" {
					lowercaseContent := strings.ToLower(chunk.Content)
					
					// Check for exact phrase match (higher score)
					if strings.Contains(lowercaseContent, lowercaseQuery) {
						keywordScore += 0.3
					} else {
						// Check for individual word matches
						matchCount := 0
						for _, word := range queryWords {
							if len(word) > 2 && strings.Contains(lowercaseContent, word) {
								matchCount++
							}
						}
						
						if matchCount > 0 {
							keywordScore += float64(matchCount) / float64(len(queryWords)) * 0.2
						}
					}
				}
				
				// Final score combines semantic, keyword, title, and topic matches
				combinedScore := semanticScore*0.6 + keywordScore + titleMatchScore + topicMatchScore
				
				// Use a dynamic threshold based on query length
				threshold := 0.4
				if len(queryWords) > 3 {
					threshold = 0.3 
				}
				
				// Add to results if combined score is high enough
				if combinedScore > threshold {
					// Create preview with highlighted match
					preview := generateMatchPreview(chunk.Content, lowercaseQuery, queryWords)
					
					match := &types.DocumentMatch{
						DocumentID:   doc.ID,
						ChunkID:      chunk.ID,
						ChunkIndex:   i,
						Content:      preview,            
						RawContent:   chunk.Content,      
						Similarity:   combinedScore,      
						DocumentName: doc.Metadata.Filename,
						Metadata: &types.SearchResultMetadata{
							FileType:      doc.Metadata.Filetype,
							SemanticScore: &semanticScore,      
							KeywordScore:  &keywordScore,       
							TopicScore:    &topicMatchScore,    
							TitleScore:    &titleMatchScore,    
						},
					}
					
					matches = append(matches, match)
					
					if !docAlreadyMatched {
						matchedDocIds[doc.ID] = true
						docAlreadyMatched = true
					}
				}
			}
		}
	}
	
	// Sort matches by similarity (highest first)
	sort.SliceStable(matches, func(i, j int) bool {
		return matches[i].Similarity > matches[j].Similarity
	})
	
	// Add document topic information to each match
	for _, match := range matches {
		for _, doc := range documents {
			if doc.ID == match.DocumentID && doc.Analysis != nil {
				if match.Metadata != nil {
					topicCount := min(len(doc.Analysis.Topics), 5)
					match.Metadata.TopicList = make([]string, topicCount)
					for i := 0; i < topicCount; i++ {
						match.Metadata.TopicList[i] = doc.Analysis.Topics[i].Name 
					}
				}
				break
			}
		}
	}
	
	// Ensure diversity: re-rank to avoid too many chunks from the same document
	if len(matches) > 5 {
		matches = diversifyResults(matches)
	}
	
	// Limit results
	if limit > 0 && len(matches) > limit {
		matches = matches[:limit]
	}
	
	return matches, nil
}

// generateMatchPreview creates a context snippet around the matching text
func generateMatchPreview(content, queryLower string, queryWords []string) string {
	if content == "" {
		return ""
	}
	
	matchPos := strings.Index(strings.ToLower(content), queryLower)
	
	if matchPos == -1 {
		for _, word := range queryWords {
			if len(word) > 2 { 
				matchPos = strings.Index(strings.ToLower(content), word)
				if matchPos != -1 {
					break
				}
			}
		}
	}
	
	if matchPos == -1 {
		if len(content) <= 200 {
			return content
		}
		return content[:200] + "..."
	}
	
	start := matchPos - 100
	if start < 0 {
		start = 0
	}
	
	end := matchPos + 150
	if end > len(content) {
		end = len(content)
	}
	
	prefix := ""
	if start > 0 {
		prefix = "..."
	}
	
	suffix := ""
	if end < len(content) {
		suffix = "..."
	}
	
	return prefix + content[start:end] + suffix
}

// diversifyResults ensures results have diversity by promoting chunks from different documents
func diversifyResults(matches []*types.DocumentMatch) []*types.DocumentMatch {
	if len(matches) <= 1 {
		return matches
	}
	
	includedDocs := make(map[string]int)
	
	result := make([]*types.DocumentMatch, 0, len(matches))
	
	for _, match := range matches {
		if count, exists := includedDocs[match.DocumentID]; !exists || count < 1 {
			result = append(result, match)
			includedDocs[match.DocumentID] = includedDocs[match.DocumentID] + 1
		}
	}
	
	for _, match := range matches {
		alreadyIncluded := false
		for _, included := range result {
			if match.ChunkID == included.ChunkID {
				alreadyIncluded = true
				break
			}
		}
		
		if !alreadyIncluded && len(result) < len(matches) {
			result = append(result, match)
		}
		
		if len(result) >= len(matches) {
			break
		}
	}
	
	return result
}

// sortMatches sorts matches by similarity in descending order
func sortMatches(matches []*types.DocumentMatch) {
	for i := 0; i < len(matches); i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[i].Similarity < matches[j].Similarity {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}
}

// storeDocument saves a document to disk
func (p *Processor) storeDocument(doc *types.Document) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	
	docJSON, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("failed to encode document: %w", err)
	}
	
	docPath := filepath.Join(p.docsPath, doc.ID+".json")
	if err := os.WriteFile(docPath, docJSON, 0644); err != nil {
		return fmt.Errorf("failed to save document: %w", err)
	}
	
	return nil
}

// generateAndStoreEmbeddings generates and stores embeddings for a document
func (p *Processor) generateAndStoreEmbeddings(doc *types.Document) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	
	var embeddings [][]float64
	
	for _, chunk := range doc.Chunks {
		embedding := generateEmbedding(chunk.Content)
		embeddings = append(embeddings, embedding)
	}
	
	embeddingsJSON, err := json.Marshal(embeddings)
	if err != nil {
		return fmt.Errorf("failed to encode embeddings: %w", err)
	}
	
	embeddingsPath := filepath.Join(p.vectorStorePath, doc.ID+".embeddings")
	if err := os.WriteFile(embeddingsPath, embeddingsJSON, 0644); err != nil {
		return fmt.Errorf("failed to save embeddings: %w", err)
	}
	
	return nil
}

// getDocumentEmbeddings retrieves embeddings for a document
func (p *Processor) getDocumentEmbeddings(docID string) ([][]float64, error) {
	embeddingsPath := filepath.Join(p.vectorStorePath, docID+".embeddings")
	
	if _, err := os.Stat(embeddingsPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("embeddings not found for document: %s", docID)
	}
	
	embeddingsBytes, err := os.ReadFile(embeddingsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read embeddings: %w", err)
	}
	
	var embeddings [][]float64
	if err := json.Unmarshal(embeddingsBytes, &embeddings); err != nil {
		return nil, fmt.Errorf("failed to parse embeddings: %w", err)
	}
	
	return embeddings, nil
}

// generateDocumentID generates a unique ID for a document
func generateDocumentID(content []byte) string {
	hash := sha256.Sum256(content)
	return fmt.Sprintf("%x", hash)[:16] 
}

// extractMetadata extracts metadata from a file
func extractMetadata(filePath string, fileInfo os.FileInfo, content []byte) *types.DocumentMetadata {
	filename := filepath.Base(filePath)
	fileExt := strings.ToLower(filepath.Ext(filePath))
	fileSize := fileInfo.Size()
	modTime := fileInfo.ModTime()
	
	fileType := determineFileType(fileExt)
	
	wordCount := countWords(string(content))
	
	estimatedPages := int(math.Ceil(float64(wordCount) / 250.0))
	
	summary := generateSummary(string(content), 200)
	
	return &types.DocumentMetadata{
		Filename:       filename,
		Filetype:       fileType,
		Filesize:       fileSize,
		OriginalPath:   filePath,
		UploadDate:     time.Now(),
		LastModifiedDate: modTime,
		WordCount:      wordCount,
		PageCount:      estimatedPages,
		ContentSummary: summary,
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
	sentences := splitSentences(text)
	
	var summary strings.Builder
	for _, sentence := range sentences {
		if summary.Len()+len(sentence)+1 > maxLength {
			break
		}
		summary.WriteString(sentence)
		summary.WriteString(" ")
	}
	
	result := strings.TrimSpace(summary.String())
	if len(result) > maxLength {
		result = result[:maxLength]
	}
	
	return result
}

// splitSentences splits text into sentences (simple implementation)
func splitSentences(text string) []string {
	text = regexp.MustCompile(`(Mr\.|Mrs\.|Dr\.|etc\.|i\.e\.|e\.g\.)`).ReplaceAllStringFunc(text, func(m string) string {
		return strings.ReplaceAll(m, ".", "<DOT>")
	})
	
	parts := regexp.MustCompile(`[.!?]+`).Split(text, -1)
	
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
func analyzeDocument(text string) (*types.DocumentAnalysis, error) {
	sectionsPtrs := extractSections(text)
	tocPtrs := generateTableOfContents(sectionsPtrs)
	entitiesMap := extractEntities(text)
	topicsStrings := extractTopics(text)

	// Convert slices of pointers/maps to slices of values for DocumentAnalysis
	sections := make([]types.DocumentSection, len(sectionsPtrs))
	for i, ptr := range sectionsPtrs {
		sections[i] = *ptr
	}
	toc := make([]types.TOCEntry, len(tocPtrs))
	for i, ptr := range tocPtrs {
		toc[i] = *ptr
	}
	entities := make([]types.DocumentEntity, 0)
	for _, entitySlice := range entitiesMap {
		entities = append(entities, entitySlice...)
	}
	topics := make([]types.DocumentTopic, len(topicsStrings))
	for i, topicStr := range topicsStrings {
		topics[i] = types.DocumentTopic{Name: topicStr, Weight: 0} // Use Name, assuming default weight
	}

	return &types.DocumentAnalysis{
		ID:              "", // Should be set by caller
		Sections:        sections,
		TableOfContents: toc,
		Entities:        entities,
		Topics:          topics,
		AnalyzedAt:      time.Now(),
		WordCount:       0, // TODO: Calculate word count during analysis
		PageCount:       0, // TODO: Calculate page count during analysis
	}, nil
}

// extractSections extracts sections from the document text
func extractSections(text string) []*types.DocumentSection {
	var sections []*types.DocumentSection
	
	headingPattern := regexp.MustCompile(`(?m)^(#{1,6})\s+(.+)$`)
	matches := headingPattern.FindAllStringSubmatchIndex(text, -1)
	
	if len(matches) == 0 {
		sections = append(sections, &types.DocumentSection{
			Index:         0,
			Heading:       "",
			HeadingLevel:  0,
			Content:       text,
			StartPosition: 0,
			Length:        len(text),
		})
		return sections
	}
	
	for i, match := range matches {
		level := len(text[match[2]:match[3]])
		heading := text[match[4]:match[5]]
		
		var content string
		startPos := match[1] 
		endPos := len(text)
		
		if i < len(matches)-1 {
			endPos = matches[i+1][0] 
		}
		
		content = text[startPos:endPos]
		
		section := &types.DocumentSection{
			Index:         i,
			Heading:       heading,
			HeadingLevel:  level,
			Content:       strings.TrimSpace(content),
			StartPosition: startPos,
			Length:        endPos - startPos,
		}
		
		sections = append(sections, section)
	}
	
	return sections
}

// generateTableOfContents generates TOC from sections
func generateTableOfContents(sections []*types.DocumentSection) []*types.TOCEntry {
	var toc []*types.TOCEntry
	
	for i, section := range sections {
		entry := &types.TOCEntry{
			Title:        section.Heading,
			Level:        section.HeadingLevel,
			Position:     section.StartPosition, // Use StartPosition
		}
		
		toc = append(toc, entry)
	}
	
	return toc
}

// extractEntities extracts entities from text
func extractEntities(text string) map[string][]types.DocumentEntity {
	entities := make(map[string][]types.DocumentEntity)
	
	emailPattern := regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`)
	emailMatches := emailPattern.FindAllString(text, -1)
	
	var emails []types.DocumentEntity
	for _, match := range emailMatches {
		emails = append(emails, types.DocumentEntity{
			Type:     "email",
			Value:    match, // Corrected: Use Value
			Position: 0, // TODO: Find actual position
		})
	}
	
	if len(emails) > 0 {
		entities["emails"] = emails
	}
	
	urlPattern := regexp.MustCompile(`https?://[^\s]+`)
	urlMatches := urlPattern.FindAllString(text, -1)
	
	var urls []types.DocumentEntity
	for _, match := range urlMatches {
		urls = append(urls, types.DocumentEntity{
			Type:     "url",
			Value:    match, // Corrected: Use Value
			Position: 0, // TODO: Find actual position
		})
	}
	
	if len(urls) > 0 {
		entities["urls"] = urls
	}
	
	datePattern := regexp.MustCompile(`\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b`)
	dateMatches := datePattern.FindAllString(text, -1)
	
	var dates []types.DocumentEntity
	for _, match := range dateMatches {
		dates = append(dates, types.DocumentEntity{
			Type:     "date",
			Value:    match, // Corrected: Use Value
			Position: 0, // TODO: Find actual position
		})
	}
	
	if len(dates) > 0 {
		entities["dates"] = dates
	}
	
	return entities
}

// extractTopics extracts main topics from the document
func extractTopics(text string) []string {
	words := strings.Fields(text)
	
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
	
	var wordFreqs []wordFreq
	for word, count := range wordCounts {
		if count >= 3 { 
			wordFreqs = append(wordFreqs, wordFreq{word, count})
		}
	}
	
	for i := 0; i < len(wordFreqs); i++ {
		for j := i + 1; j < len(wordFreqs); j++ {
			if wordFreqs[i].count < wordFreqs[j].count {
				wordFreqs[i], wordFreqs[j] = wordFreqs[j], wordFreqs[i]
			}
		}
	}
	
	var topics []string
	maxTopics := 10
	for i := 0; i < len(wordFreqs) && i < maxTopics; i++ {
		topics = append(topics, wordFreqs[i].word)
	}
	
	return topics
}

// generateChunks splits document into chunks for searching
func generateChunks(docID string, text string) ([]*types.DocumentChunk, error) {
	var chunks []*types.DocumentChunk
	
	chunkSize := 1000 
	chunkOverlap := 200
	
	textLen := len(text)
	
	for start := 0; start < textLen; start += chunkSize - chunkOverlap {
		end := start + chunkSize
		if end > textLen {
			end = textLen
		}
		
		chunkContent := text[start:end]
		
		chunkID := fmt.Sprintf("%s-chunk-%d", docID, len(chunks))
		chunk := &types.DocumentChunk{
			ID:       chunkID,
			DocID:    docID,
			Index:    len(chunks),
			StartPos: start,
			Length:   end - start,
			Content:  chunkContent,
		}
		
		chunks = append(chunks, chunk)
		
		if end >= textLen {
			break
		}
	}
	
	return chunks, nil
}

// generateEmbedding generates a vector embedding for a text using hash-based approach
func generateEmbedding(text string) []float64 {
	text = strings.ToLower(text)
	text = regexp.MustCompile(`\s+`).ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	
	hash := sha256.New()
	io.WriteString(hash, text)
	hashBytes := hash.Sum(nil)
	
	dimensions := 128
	embedding := make([]float64, dimensions)
	
	for i := 0; i < dimensions; i++ {
		hashIndex := i % len(hashBytes)
		
		value := float64(hashBytes[hashIndex])/128.0 - 1.0
		
		embedding[i] = value
	}
	
	embedding = normalizeVector(embedding)
	
	return embedding
}

// normalizeVector normalizes a vector to unit length
func normalizeVector(vector []float64) []float64 {
	var sumSquares float64
	for _, v := range vector {
		sumSquares += v * v
	}
	magnitude := math.Sqrt(sumSquares)
	
	if magnitude == 0 {
		return vector
	}
	
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

type wordFreq struct {
	word  string
	count int
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
