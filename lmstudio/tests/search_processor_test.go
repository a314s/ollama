package tests

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ollama/ollama/lmstudio/documents"
	"github.com/ollama/ollama/lmstudio/types"
)

// TestSearchProcessor tests the search functionality of the document processor.
func TestSearchProcessor(t *testing.T) {
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
	doc1Path := createTestFile(t, "doc1.txt", "Document about apples.")
	doc1, err := processor.ProcessDocument(context.Background(), doc1Path)
	require.NoError(t, err)

	doc2Path := createTestFile(t, "doc2.txt", "A second document, this one mentions oranges.")
	doc2, err := processor.ProcessDocument(context.Background(), doc2Path)
	require.NoError(t, err)

	// --- Test Cases ---

	// Test Case 1: Search for "apples"
	matchesApples, err := processor.SearchDocuments(context.Background(), "apples", 5)
	require.NoError(t, err)
	assert.NotEmpty(t, matchesApples, "Search for 'apples' should return matches")
	assert.True(t, containsDocID(matchesApples, doc1.ID), "Search results for 'apples' should include doc1")
	assert.False(t, containsDocID(matchesApples, doc2.ID), "Search results for 'apples' should NOT include doc2")
	assert.Greater(t, matchesApples[0].Similarity, 0.7, "Similarity for 'apples' should be high") // Adjust threshold as needed

	// Test Case 2: Search for "oranges"
	matchesOranges, err := processor.SearchDocuments(context.Background(), "oranges", 5)
	require.NoError(t, err)
	assert.NotEmpty(t, matchesOranges, "Search for 'oranges' should return matches")
	assert.True(t, containsDocID(matchesOranges, doc2.ID), "Search results for 'oranges' should include doc2")
	assert.False(t, containsDocID(matchesOranges, doc1.ID), "Search results for 'oranges' should NOT include doc1")
	assert.Greater(t, matchesOranges[0].Similarity, 0.7, "Similarity for 'oranges' should be high")

	// Test Case 3: Search for "document"
	matchesDocument, err := processor.SearchDocuments(context.Background(), "document", 5)
	require.NoError(t, err)
	assert.Len(t, matchesDocument, 2, "Search for 'document' should return 2 matches")
	assert.True(t, containsDocID(matchesDocument, doc1.ID), "Search results for 'document' should include doc1")
	assert.True(t, containsDocID(matchesDocument, doc2.ID), "Search results for 'document' should include doc2")
	// Check if results are somewhat ordered (doc1 might be slightly higher due to exact match)
	// This depends heavily on the embedding/similarity function
	// assert.Equal(t, doc1.ID, matchesDocument[0].DocumentID) // This might be too strict

	// Test Case 4: Search for something not present
	matchesNotFound, err := processor.SearchDocuments(context.Background(), "banana", 5)
	require.NoError(t, err)
	assert.Empty(t, matchesNotFound, "Search for 'banana' should return no matches")

	// Test Case 5: Limit results
	matchesLimit, err := processor.SearchDocuments(context.Background(), "document", 1)
	require.NoError(t, err)
	assert.Len(t, matchesLimit, 1, "Search with limit=1 should return 1 match")
}

// containsDocID checks if a list of matches contains a specific document ID.
func containsDocID(matches []types.DocumentMatch, docID string) bool {
	for _, match := range matches {
		if match.DocumentID == docID {
			return true
		}
	}
	return false
}

// createTestFile creates a temporary file with specific content.
// Duplicated here for simplicity, could be moved to a shared test helper.
func createTestFile(t *testing.T, name, content string) string {
	tempFile, err := os.CreateTemp("", name)
	require.NoError(t, err)
	defer tempFile.Close()
	_, err = tempFile.WriteString(content)
	require.NoError(t, err)
	return tempFile.Name()
}
