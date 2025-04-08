package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/documents"
	"github.com/ollama/ollama/status"
)

// RegisterRoutes adds the LMStudio API routes to the given router
func RegisterRoutes(router *gin.Engine) {
	// HuggingFace model management routes
	router.GET("/api/huggingface/models", ListHuggingFaceModels)
	router.POST("/api/huggingface/models/download", DownloadHuggingFaceModel)
	router.GET("/api/huggingface/models/:model", GetHuggingFaceModel)
	
	// Status routes
	router.GET("/api/status", GetSystemStatus)
	router.GET("/api/status/tests", RunTests)
	router.POST("/api/status/fix", FixComponent)
	
	// Document routes
	router.GET("/api/documents", ListDocuments)
	router.GET("/api/documents/:id", GetDocument)
	router.POST("/api/documents", UploadDocument)
	router.DELETE("/api/documents/:id", DeleteDocument)
	router.GET("/api/documents/search", SearchDocuments)
	router.GET("/api/documents/:id/open", OpenDocument)
	router.GET("/api/documents/:id/sections", GetDocumentSections)
	router.GET("/api/documents/:id/toc", GetDocumentTOC)
	router.GET("/api/documents/:id/entities", GetDocumentEntities)
}

// ListHuggingFaceModels returns a list of available HuggingFace models
func ListHuggingFaceModels(c *gin.Context) {
	// Implementation will be added
	c.JSON(http.StatusOK, gin.H{
		"models": []gin.H{},
	})
}

// DownloadHuggingFaceModel downloads a model from HuggingFace
func DownloadHuggingFaceModel(c *gin.Context) {
	// Implementation will be added
	c.JSON(http.StatusAccepted, gin.H{
		"status": "downloading",
	})
}

// GetHuggingFaceModel returns details about a specific HuggingFace model
func GetHuggingFaceModel(c *gin.Context) {
	// Implementation will be added
	c.JSON(http.StatusOK, gin.H{
		"name": c.Param("model"),
	})
}

// GetSystemStatus returns the current system status
func GetSystemStatus(c *gin.Context) {
	statusTracker := status.GetTracker()
	systemStatus := statusTracker.GetSystemStatus(c.Request.Context())
	
	c.JSON(http.StatusOK, systemStatus)
}

// RunTests runs system tests
func RunTests(c *gin.Context) {
	testID := c.Query("test_id")
	statusTracker := status.GetTracker()
	
	var results []*api.TestResult
	var err error
	
	if testID != "" {
		// Run a specific test
		result, err := statusTracker.RunTest(c.Request.Context(), testID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to run test: %v", err),
			})
			return
		}
		results = []*api.TestResult{result}
	} else {
		// Run all tests
		results, err = statusTracker.RunAllTests(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to run tests: %v", err),
			})
			return
		}
	}
	
	c.JSON(http.StatusOK, results)
}

// FixComponent attempts to fix a component
func FixComponent(c *gin.Context) {
	var request struct {
		ComponentID string `json:"component_id"`
	}
	
	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}
	
	statusTracker := status.GetTracker()
	success, actions, err := statusTracker.FixComponent(c.Request.Context(), request.ComponentID)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to fix component: %v", err),
		})
		return
	}
	
	result := &api.FixResult{
		Success:   success,
		Message:   getFixResultMessage(success),
		Actions:   actions,
		Component: request.ComponentID,
	}
	
	c.JSON(http.StatusOK, result)
}

// getFixResultMessage returns a message for the fix result
func getFixResultMessage(success bool) string {
	if success {
		return "Component fixed successfully"
	}
	return "Component fix partially succeeded or failed"
}

// DocumentProcessor returns the document processor
func getDocumentProcessor() *documents.Processor {
	docsPath := os.Getenv("LMSTUDIO_DOCS_PATH")
	if docsPath == "" {
		docsPath = filepath.Join(os.TempDir(), "lmstudio", "docs")
	}
	
	vectorStorePath := os.Getenv("LMSTUDIO_VECTOR_STORE_PATH")
	if vectorStorePath == "" {
		vectorStorePath = filepath.Join(os.TempDir(), "lmstudio", "vectorstore")
	}
	
	return documents.NewProcessor(docsPath, vectorStorePath)
}

// ListDocuments returns a list of all documents
func ListDocuments(c *gin.Context) {
	processor := getDocumentProcessor()
	docs, err := processor.GetAllDocuments(c.Request.Context())
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to list documents: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, docs)
}

// GetDocument returns a specific document
func GetDocument(c *gin.Context) {
	docID := c.Param("id")
	processor := getDocumentProcessor()
	
	doc, err := processor.GetDocument(c.Request.Context(), docID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Document not found: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, doc)
}

// UploadDocument uploads and processes a document
func UploadDocument(c *gin.Context) {
	// Get the file from the request
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Failed to get file: %v", err),
		})
		return
	}
	defer file.Close()
	
	// Create a temporary file to save the uploaded file
	tmpFile, err := os.CreateTemp("", "upload-*."+filepath.Ext(header.Filename))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to create temporary file: %v", err),
		})
		return
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()
	
	// Copy the uploaded file to the temporary file
	_, err = io.Copy(tmpFile, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to copy file: %v", err),
		})
		return
	}
	
	// Process the document
	processor := getDocumentProcessor()
	doc, err := processor.ProcessDocument(c.Request.Context(), tmpFile.Name())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to process document: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, doc)
}

// DeleteDocument deletes a document
func DeleteDocument(c *gin.Context) {
	docID := c.Param("id")
	processor := getDocumentProcessor()
	
	err := processor.DeleteDocument(c.Request.Context(), docID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Failed to delete document: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Document %s deleted successfully", docID),
	})
}

// SearchDocuments searches for documents
func SearchDocuments(c *gin.Context) {
	query := c.Query("q")
	limitStr := c.DefaultQuery("limit", "10")
	
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid limit: %v", err),
		})
		return
	}
	
	processor := getDocumentProcessor()
	matches, err := processor.SearchDocuments(c.Request.Context(), query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to search documents: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, matches)
}

// OpenDocument opens a document in the default application
func OpenDocument(c *gin.Context) {
	docID := c.Param("id")
	processor := getDocumentProcessor()
	
	doc, err := processor.GetDocument(c.Request.Context(), docID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Document not found: %v", err),
		})
		return
	}
	
	// Check if the original path exists
	originalPath := doc.Metadata.OriginalPath
	if _, err := os.Stat(originalPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Original document file not found",
		})
		return
	}
	
	// Open the file with the default application (platform-specific)
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", originalPath)
	case "darwin":
		cmd = exec.Command("open", originalPath)
	default: // linux and others
		cmd = exec.Command("xdg-open", originalPath)
	}
	
	if err := cmd.Start(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to open document: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Document %s opened successfully", docID),
	})
}

// GetDocumentSections returns the sections of a document
func GetDocumentSections(c *gin.Context) {
	docID := c.Param("id")
	processor := getDocumentProcessor()
	
	doc, err := processor.GetDocument(c.Request.Context(), docID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Document not found: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, doc.Analysis.Sections)
}

// GetDocumentTOC returns the table of contents of a document
func GetDocumentTOC(c *gin.Context) {
	docID := c.Param("id")
	processor := getDocumentProcessor()
	
	doc, err := processor.GetDocument(c.Request.Context(), docID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Document not found: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, doc.Analysis.TableOfContents)
}

// GetDocumentEntities returns the entities of a document
func GetDocumentEntities(c *gin.Context) {
	docID := c.Param("id")
	processor := getDocumentProcessor()
	
	doc, err := processor.GetDocument(c.Request.Context(), docID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Document not found: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, doc.Analysis.Entities)
}
