package utils

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

// ImageUploader handles image uploads to Cloudinary
type ImageUploader struct {
	cloudinary *cloudinary.Cloudinary
	folder     string
}

// UploadResult contains the result of an image upload
type UploadResult struct {
	URL      string
	PublicID string
	Format   string
	Width    int
	Height   int
	Size     int
}

// NewImageUploader creates a new ImageUploader instance
func NewImageUploader(cloudName, apiKey, apiSecret, folder string) (*ImageUploader, error) {
	cld, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cloudinary: %w", err)
	}

	return &ImageUploader{
		cloudinary: cld,
		folder:     folder,
	}, nil
}

func DiffPhotoURLs(oldSlice, currentSlice []string) []string {
	diff := []string{}
	currentMap := make(map[string]bool)

	for _, url := range currentSlice {
		currentMap[url] = true
	}
	for _, url := range oldSlice {
		if !currentMap[url] {
			diff = append(diff, url)
		}
	}
	return diff
}

// UploadImage uploads a single image to Cloudinary
func (u *ImageUploader) UploadImage(ctx context.Context, reader io.Reader, filename string) (*UploadResult, error) {
	if err := u.validateFile(filename); err != nil {
		return nil, err
	}

	// Generate unique public ID
	publicID := u.generatePublicID(filename)

	uploadParams := uploader.UploadParams{
		PublicID:       publicID,
		Folder:         u.folder,
		ResourceType:   "image",
		Transformation: "f_auto,q_auto", // Auto format and quality optimization
	}

	result, err := u.cloudinary.Upload.Upload(ctx, reader, uploadParams)
	if err != nil {
		return nil, fmt.Errorf("failed to upload image: %w", err)
	}

	return &UploadResult{
		URL:      result.SecureURL,
		PublicID: result.PublicID,
		Format:   result.Format,
		Width:    result.Width,
		Height:   result.Height,
		Size:     result.Bytes,
	}, nil
}

// UploadBase64 uploads a base64-encoded image
func (u *ImageUploader) UploadBase64(ctx context.Context, base64Data, filename string) (*UploadResult, error) {
	if err := u.validateFile(filename); err != nil {
		return nil, err
	}

	publicID := u.generatePublicID(filename)

	uploadParams := uploader.UploadParams{
		PublicID:       publicID,
		Folder:         u.folder,
		ResourceType:   "image",
		Transformation: "f_auto,q_auto",
	}

	result, err := u.cloudinary.Upload.Upload(ctx, base64Data, uploadParams)
	if err != nil {
		return nil, fmt.Errorf("failed to upload base64 image: %w", err)
	}

	return &UploadResult{
		URL:      result.SecureURL,
		PublicID: result.PublicID,
		Format:   result.Format,
		Width:    result.Width,
		Height:   result.Height,
		Size:     result.Bytes,
	}, nil
}

// UploadRemoteImage downloads an image from a URL and uploads it to Cloudinary.
func (u *ImageUploader) UploadRemoteImage(ctx context.Context, imageURL string) (*UploadResult, error) {
	resp, err := http.Get(imageURL)
	if err != nil {
		return nil, fmt.Errorf("failed to download remote image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to download remote image: status %s", resp.Status)
	}

	filename := u.filenameFromURL(imageURL, resp.Header.Get("Content-Type"))
	return u.UploadImage(ctx, resp.Body, filename)
}

func (u *ImageUploader) filenameFromURL(imageURL, contentType string) string {
	filename := "remote_image"
	if parsed, err := url.Parse(imageURL); err == nil {
		name := path.Base(parsed.Path)
		if name != "" && strings.Contains(name, ".") {
			filename = name
		}
	}

	if filepath.Ext(filename) == "" {
		ext := extensionFromContentType(contentType)
		if ext == "" {
			ext = ".jpg"
		}
		filename += ext
	}

	return filename
}

func extensionFromContentType(contentType string) string {
	if contentType == "" {
		return ""
	}

	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return ""
	}

	exts, err := mime.ExtensionsByType(mediaType)
	if err != nil || len(exts) == 0 {
		return ""
	}

	return exts[0]
}

// DeleteImage deletes an image from Cloudinary by its public ID
func (u *ImageUploader) DeleteImage(ctx context.Context, publicID string) error {
	_, err := u.cloudinary.Upload.Destroy(ctx, uploader.DestroyParams{
		PublicID: publicID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete image: %w", err)
	}
	return nil
}

// DeleteImageByURL deletes an image from Cloudinary using the full secured URL.
func (u *ImageUploader) DeleteImageByURL(ctx context.Context, imageURL string) error {
	if imageURL == "" {
		return nil
	}

	publicID := ExtractPublicIDFromURL(imageURL)
	if publicID == "" {
		return fmt.Errorf("unable to determine public ID from URL: %s", imageURL)
	}

	return u.DeleteImage(ctx, publicID)
}

// ExtractPublicIDFromURL extracts the Cloudinary public ID from a stored image URL.
func ExtractPublicIDFromURL(imageURL string) string {
	if imageURL == "" {
		return ""
	}

	parsed, err := url.Parse(imageURL)
	if err != nil {
		return ""
	}

	pathStr := parsed.Path
	if idx := strings.Index(pathStr, "/upload/"); idx >= 0 {
		pathStr = pathStr[idx+len("/upload/"):]
	}
	pathStr = strings.Trim(pathStr, "/")
	if pathStr == "" {
		return ""
	}

	segments := strings.Split(pathStr, "/")
	if len(segments) > 0 && strings.HasPrefix(segments[0], "v") {
		segments = segments[1:]
	}
	if len(segments) == 0 {
		return ""
	}

	lastSegment := segments[len(segments)-1]
	segments[len(segments)-1] = strings.TrimSuffix(lastSegment, filepath.Ext(lastSegment))

	return strings.Join(segments, "/")
}

// GetOptimizedURL returns an optimized URL for an existing image
func (u *ImageUploader) GetOptimizedURL(publicID string, width, height int) (string, error) {
	img, err := u.cloudinary.Image(publicID)
	if err != nil {
		return "", fmt.Errorf("failed to get image asset: %w", err)
	}

	if width > 0 && height > 0 {
		img.Transformation = fmt.Sprintf("w_%d,h_%d,c_fill", width, height)
	}

	url, err := img.String()
	if err != nil {
		return "", fmt.Errorf("failed to generate image URL: %w", err)
	}
	return url, nil
}

// validateFile checks if the file has an allowed extension
func (u *ImageUploader) validateFile(filename string) error {
	ext := strings.ToLower(filepath.Ext(filename))
	allowed := []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"}

	for _, allowedExt := range allowed {
		if ext == allowedExt {
			return nil
		}
	}

	return fmt.Errorf("unsupported file type: %s (allowed: jpg, jpeg, png, gif, webp, svg, bmp, ico)", ext)
}

// generatePublicID creates a unique public ID for the image
func (u *ImageUploader) generatePublicID(filename string) string {
	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, ext)
	// Clean the name - remove special characters and spaces
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "-", "_")

	timestamp := time.Now().Unix()
	return fmt.Sprintf("%s_%d", name, timestamp)
}

// WithFolder creates a new uploader with a different folder
func (u *ImageUploader) WithFolder(folder string) *ImageUploader {
	return &ImageUploader{
		cloudinary: u.cloudinary,
		folder:     folder,
	}
}

// AllowedMimeTypes returns the list of allowed MIME types
func AllowedMimeTypes() []string {
	return []string{
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/svg+xml",
		"image/bmp",
		"image/x-icon",
	}
}

// MaxFileSize returns the maximum allowed file size (10MB)
func MaxFileSize() int64 {
	return 10 * 1024 * 1024 // 10MB
}
