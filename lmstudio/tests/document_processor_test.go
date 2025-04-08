package tests

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/ollama/ollama/lmstudio/documents"
	"github.com/ollama/ollama/lmstudio/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestDocumentProcessor tests basic document processing functions.
func TestDocumentProcessor(t *testing.T) {
	// Create temporary test directories
	tempDir, err := ioutil.TempDir("", "doc-test-")
	require.NoError(t, err)
	defer os.RemoveAll(tempDir)

	docsPath := filepath.Join(tempDir, "docs")
	vectorStorePath := filepath.Join(tempDir, "vectors")
	
	err = os.MkdirAll(docsPath, 0755)
	require.NoError(t, err)
	
	err = os.MkdirAll(vectorStorePath, 0755)
	require.NoError(t, err)

	// Initialize the document processor
	processor := documents.NewProcessor(docsPath, vectorStorePath)
	require.NotNil(t, processor)

	ctx := context.Background()

	// Test Case 1: Process a simple text file
	txtContent := "This is the content of the test file.\nIt has multiple lines."
	txtFilePath := createTempTestFile(t, "test1.txt", txtContent)

	doc1, err := processor.ProcessDocument(ctx, txtFilePath)
	require.NoError(t, err, "Failed to process text file")
	require.NotNil(t, doc1, "Processed document is nil")

	// Verify Metadata
	assert.NotEmpty(t, doc1.ID, "Document ID should not be empty")
	assert.Equal(t, "test1.txt", doc1.Metadata.Filename, "Filename mismatch")
	assert.Equal(t, ".txt", doc1.Metadata.Filetype, "Filetype mismatch")
	assert.Equal(t, int64(len(txtContent)), doc1.Metadata.Filesize, "Filesize mismatch")
	assert.WithinDuration(t, time.Now(), doc1.Metadata.UploadDate, 5*time.Second, "UploadDate is incorrect")
	// assert.NotEmpty(t, doc1.Metadata.OriginalPath, "OriginalPath should not be empty") // This might not be set depending on how ProcessDocument is called
	// Placeholder checks for new metadata fields - replace with actual expected values when implemented
	assert.Greater(t, doc1.Metadata.WordCount, 5, "WordCount seems too low") // Adjust based on expected count
	assert.GreaterOrEqual(t, doc1.Metadata.EstimatedPages, 1, "EstimatedPages should be at least 1")
	assert.NotEmpty(t, doc1.Metadata.ContentSummary, "ContentSummary should not be empty")

	// Verify Analysis (Basic Checks - Replace with more detailed checks when analysis is implemented)
	assert.Equal(t, doc1.ID, doc1.Analysis.ID, "Analysis ID mismatch")
	assert.NotEmpty(t, doc1.Analysis.Sections, "Analysis sections should not be empty (even if just one)")
	// assert.NotEmpty(t, doc1.Analysis.Entities, "Analysis entities should be populated") // Enable when entity extraction works
	// assert.NotEmpty(t, doc1.Analysis.Topics, "Analysis topics should be populated") // Enable when topic extraction works
	// assert.NotEmpty(t, doc1.Analysis.TableOfContents, "Analysis TOC should be populated") // Enable when TOC generation works
	assert.WithinDuration(t, time.Now(), doc1.Analysis.AnalyzedAt, 5*time.Second, "AnalyzedAt is incorrect")


	// Verify Chunks
	require.NotEmpty(t, doc1.Chunks, "Document chunks are empty")
	firstChunk := doc1.Chunks[0]
	assert.NotEmpty(t, firstChunk.ID, "Chunk ID is empty")
	assert.Equal(t, doc1.ID, firstChunk.DocumentID, "Chunk DocumentID mismatch")
	assert.Equal(t, 0, firstChunk.ChunkIndex, "First chunk index should be 0")
	assert.Equal(t, txtContent, firstChunk.Content, "Chunk content mismatch (assuming single chunk for short text)")
	assert.Equal(t, 0, firstChunk.StartPosition, "Chunk StartPosition mismatch")
	assert.Equal(t, len(txtContent), firstChunk.Length, "Chunk Length mismatch")
	assert.NotEmpty(t, firstChunk.Preview, "Chunk preview should not be empty")
	assert.NotEmpty(t, firstChunk.Embedding, "Chunk embedding should not be empty")
	assert.Len(t, firstChunk.Embedding, 128, "Embedding dimension should be 128 for SHA256 hash method") // Specific to current hash embedding

	// Test Case 2: Get the processed document
	retrievedDoc, err := processor.GetDocument(ctx, doc1.ID)
	require.NoError(t, err, "Failed to get document")
	require.NotNil(t, retrievedDoc, "Retrieved document is nil")
	assert.Equal(t, doc1.ID, retrievedDoc.ID, "Retrieved document ID mismatch")
	assert.Equal(t, doc1.Metadata.Filename, retrievedDoc.Metadata.Filename, "Retrieved filename mismatch")
	assert.Equal(t, len(doc1.Chunks), len(retrievedDoc.Chunks), "Retrieved chunk count mismatch")
	assert.Equal(t, doc1.Chunks[0].Content, retrievedDoc.Chunks[0].Content, "Retrieved chunk content mismatch")

	// Test Case 3: Get all documents (metadata)
	// Process another doc first
	txtContent2 := "Second file."
	txtFilePath2 := createTempTestFile(t, "test2.txt", txtContent2)
	doc2, err := processor.ProcessDocument(ctx, txtFilePath2)
	require.NoError(t, err)

	allDocsMeta, err := processor.GetAllDocumentsMetadata(ctx)
	require.NoError(t, err, "Failed to get all documents metadata")
	assert.Len(t, allDocsMeta, 2, "Should be 2 documents in metadata list")

	foundDoc1 := false
	foundDoc2 := false
	for _, meta := range allDocsMeta {
		if meta.ID == doc1.ID {
			foundDoc1 = true
			assert.Equal(t, "test1.txt", meta.Filename)
		} else if meta.ID == doc2.ID {
			foundDoc2 = true
			assert.Equal(t, "test2.txt", meta.Filename)
		}
	}
	assert.True(t, foundDoc1, "Doc1 metadata not found in list")
	assert.True(t, foundDoc2, "Doc2 metadata not found in list")


	// Test Case 4: Delete a document
	err = processor.DeleteDocument(ctx, doc1.ID)
	require.NoError(t, err, "Failed to delete document 1")

	// Verify deletion
	_, err = processor.GetDocument(ctx, doc1.ID)
	require.Error(t, err, "Getting deleted document should return an error")
	assert.ErrorContains(t, err, "not found", "Error message should indicate not found")

	// Verify it's gone from the list
	allDocsMetaAfterDelete, err := processor.GetAllDocumentsMetadata(ctx)
	require.NoError(t, err)
	assert.Len(t, allDocsMetaAfterDelete, 1, "Should be 1 document left after deletion")
	assert.Equal(t, doc2.ID, allDocsMetaAfterDelete[0].ID, "Remaining document should be doc2")

	// Test Case 5: Process file that doesn't exist
	_, err = processor.ProcessDocument(ctx, "/path/to/nonexistent/file.txt")
	require.Error(t, err, "Processing non-existent file should return error")
	assert.ErrorContains(t, err, "no such file or directory", "Error message should indicate file not found")

}

// createTempTestFile is a helper to create a temporary file for testing.
func createTempTestFile(t *testing.T, name, content string) string {
	tempFile, err := os.CreateTemp("", name)
	require.NoError(t, err, "Failed to create temp file")
	defer tempFile.Close()

	_, err = tempFile.WriteString(content)
	require.NoError(t, err, "Failed to write to temp file")

	return tempFile.Name()
}
