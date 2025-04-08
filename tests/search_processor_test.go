package tests

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/documents"
)

// TestEnhancedSearch tests the enhanced search functionality
func TestEnhancedSearch(t *testing.T) {
	// Create a test processor
	tempDir, err := os.MkdirTemp("", "doc-search-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create document directory and vector store directory
	docDir := filepath.Join(tempDir, "documents")
	vectorDir := filepath.Join(tempDir, "vectors")
	err = os.MkdirAll(docDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create document directory: %v", err)
	}
	err = os.MkdirAll(vectorDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create vector directory: %v", err)
	}

	// Create processor
	processor, err := documents.NewProcessor(docDir, vectorDir)
	if err != nil {
		t.Fatalf("Failed to create processor: %v", err)
	}

	// Create test documents with different content
	createTestDocuments(t, docDir)

	// Process the test documents
	processTestDocuments(t, processor, docDir)

	// Test cases for search
	testCases := []struct {
		name           string
		query          string
		expectedDocs   int
		expectedMinScore float64
		keywordCheck   string
	}{
		{
			name:           "Exact phrase match",
			query:          "artificial intelligence",
			expectedDocs:   1,
			expectedMinScore: 0.7,
			keywordCheck:   "artificial intelligence",
		},
		{
			name:           "Partial keyword match",
			query:          "Python programming",
			expectedDocs:   1,
			expectedMinScore: 0.5,
			keywordCheck:   "Python",
		},
		{
			name:           "Title match",
			query:          "technical specification",
			expectedDocs:   1,
			expectedMinScore: 0.4,
			keywordCheck:   "specification",
		},
		{
			name:           "Topic match",
			query:          "documentation best practices",
			expectedDocs:   1,
			expectedMinScore: 0.3,
			keywordCheck:   "documentation",
		},
		{
			name:           "Multiple word query",
			query:          "API reference guide example",
			expectedDocs:   1,
			expectedMinScore: 0.4,
			keywordCheck:   "API",
		},
		{
			name:           "No matches",
			query:          "quantum computing blockchain",
			expectedDocs:   0,
			expectedMinScore: 0,
			keywordCheck:   "",
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Search with the query
			results, err := processor.SearchDocuments(context.Background(), tc.query, 10)
			if err != nil {
				t.Fatalf("Search failed: %v", err)
			}

			// Verify number of results
			if len(results) != tc.expectedDocs {
				t.Errorf("Expected %d results, got %d", tc.expectedDocs, len(results))
			}

			if len(results) > 0 {
				// Check if similarity score meets minimum expectation
				if results[0].Similarity < tc.expectedMinScore {
					t.Errorf("Expected minimum similarity score of %f, got %f", tc.expectedMinScore, results[0].Similarity)
				}

				// Verify metadata is present
				if results[0].Metadata == nil {
					t.Errorf("Expected metadata to be present in search results")
				} else {
					// Verify score breakdown
					if results[0].Metadata.SemanticScore <= 0 {
						t.Errorf("Expected semantic score to be greater than 0")
					}

					// For exact/partial matches, verify keyword score
					if tc.keywordCheck != "" && results[0].Metadata.KeywordScore <= 0 {
						t.Errorf("Expected keyword score to be greater than 0 for query: %s", tc.query)
					}
				}

				// Verify content contains the context
				if tc.keywordCheck != "" && !contains(results[0].Content, tc.keywordCheck) && !contains(results[0].RawContent, tc.keywordCheck) {
					t.Errorf("Expected result content to contain '%s'", tc.keywordCheck)
				}
			}
		})
	}

	// Test search result diversity
	t.Run("Search result diversity", func(t *testing.T) {
		// Search with a query that should match multiple documents
		results, err := processor.SearchDocuments(context.Background(), "document", 10)
		if err != nil {
			t.Fatalf("Search failed: %v", err)
		}

		// Ensure we have multiple results
		if len(results) < 2 {
			t.Skip("Not enough results to test diversity")
		}

		// Count unique document IDs
		uniqueDocs := make(map[string]bool)
		for _, result := range results {
			uniqueDocs[result.DocumentID] = true
		}

		// Verify we have diverse results from different documents
		if len(uniqueDocs) < 2 {
			t.Errorf("Expected results from multiple documents, got results from %d documents", len(uniqueDocs))
		}
	})
}

// Helper function to create test documents with different content
func createTestDocuments(t *testing.T, docDir string) {
	docs := []struct {
		filename string
		content  string
	}{
		{
			filename: "technical_spec.txt",
			content: `Technical Specification Document
This document provides a detailed technical specification for the system.
The system includes several components for processing documents.
Artificial Intelligence is used for document analysis and entity extraction.
The document analysis pipeline includes parsing, tokenization, and semantic understanding.`,
		},
		{
			filename: "api_reference.txt",
			content: `API Reference Guide
This guide documents the API endpoints and their usage.
The API allows for document upload, search, and retrieval.
Python code examples are provided for each endpoint.
The search functionality supports both keyword and semantic search.`,
		},
		{
			filename: "user_manual.txt",
			content: `User Manual
This manual provides instructions for using the document management system.
Users can upload documents, search for content, and view document details.
The system supports various document formats including PDF, DOCX, and TXT.
Best practices for document organization are included in the appendix.`,
		},
	}

	for _, doc := range docs {
		docPath := filepath.Join(docDir, doc.filename)
		err := os.WriteFile(docPath, []byte(doc.content), 0644)
		if err != nil {
			t.Fatalf("Failed to write test document %s: %v", doc.filename, err)
		}
	}
}

// Helper function to process test documents
func processTestDocuments(t *testing.T, processor *documents.Processor, docDir string) {
	files, err := os.ReadDir(docDir)
	if err != nil {
		t.Fatalf("Failed to read document directory: %v", err)
	}

	ctx := context.Background()
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		docPath := filepath.Join(docDir, file.Name())
		doc, err := processor.ProcessDocument(ctx, docPath)
		if err != nil {
			t.Fatalf("Failed to process document %s: %v", file.Name(), err)
		}

		// Add some analysis data for testing
		if doc != nil {
			// Add topics
			topics := []string{"documentation", "technical", "reference"}
			if doc.Analysis == nil {
				doc.Analysis = &api.DocumentAnalysis{
					ID:        doc.ID,
					Topics:    topics,
					AnalyzedAt: time.Now(),
				}
			} else {
				doc.Analysis.Topics = topics
			}

			// Update the document with analysis
			err = processor.UpdateDocument(ctx, doc)
			if err != nil {
				t.Fatalf("Failed to update document with analysis: %v", err)
			}
		}
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	if s == "" || substr == "" {
		return false
	}
	return strings.Contains(s, substr)
}
