package utils

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// ImageUploader handles image uploads to Cloudflare R2 (S3-compatible)
type ImageUploader struct {
	client    *s3.Client
	bucket    string
	publicURL string // e.g. https://pub-xxxx.r2.dev  OR your custom domain, no trailing slash
	folder    string
}

// UploadResult contains the result of an image upload
type UploadResult struct {
	URL      string
	PublicID string // this is the R2 object "key" (kept as PublicID so calling code doesn't change)
	Format   string
	Width    int
	Height   int
	Size     int
}

// NewImageUploader creates a new ImageUploader instance backed by Cloudflare R2.
// accountID, accessKeyID, secretAccessKey, bucketName, publicURL come from your R2_* envs.
func NewImageUploader(accountID, accessKeyID, secretAccessKey, bucketName, publicURL, folder string) (*ImageUploader, error) {
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load R2 config: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID))
	})

	return &ImageUploader{
		client:    client,
		bucket:    bucketName,
		publicURL: strings.TrimSuffix(publicURL, "/"),
		folder:    strings.Trim(folder, "/"),
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

// UploadImage uploads a single image to R2
func (u *ImageUploader) UploadImage(ctx context.Context, reader io.Reader, filename string) (*UploadResult, error) {
	if err := u.validateFile(filename); err != nil {
		return nil, err
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read image data: %w", err)
	}

	key := u.generateKey(filename)
	contentType := contentTypeFromFilename(filename)

	_, err = u.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(u.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upload image to R2: %w", err)
	}

	return &UploadResult{
		URL:      u.publicURL + "/" + key,
		PublicID: key,
		Format:   strings.TrimPrefix(filepath.Ext(filename), "."),
		Size:     len(data),
	}, nil
}

// UploadBase64 uploads a base64-encoded image (accepts raw base64 or a data: URI)
func (u *ImageUploader) UploadBase64(ctx context.Context, base64Data, filename string) (*UploadResult, error) {
	raw := base64Data
	if idx := strings.Index(base64Data, ","); idx != -1 && strings.HasPrefix(base64Data, "data:") {
		raw = base64Data[idx+1:]
	}

	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 image: %w", err)
	}

	return u.UploadImage(ctx, bytes.NewReader(decoded), filename)
}

// UploadRemoteImage downloads an image from a URL and uploads it to R2.
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

func contentTypeFromFilename(filename string) string {
	ext := filepath.Ext(filename)
	ct := mime.TypeByExtension(ext)
	if ct == "" {
		return "application/octet-stream"
	}
	return ct
}

// DeleteImage deletes an image from R2 by its object key
func (u *ImageUploader) DeleteImage(ctx context.Context, key string) error {
	if key == "" {
		return nil
	}
	_, err := u.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(u.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete image: %w", err)
	}
	return nil
}

// DeleteImageByURL deletes an image from R2 using its full public URL.
func (u *ImageUploader) DeleteImageByURL(ctx context.Context, imageURL string) error {
	if imageURL == "" {
		return nil
	}

	key := u.ExtractKeyFromURL(imageURL)
	if key == "" {
		return fmt.Errorf("unable to determine object key from URL: %s", imageURL)
	}

	return u.DeleteImage(ctx, key)
}

// ExtractKeyFromURL extracts the R2 object key from a stored public image URL.
func (u *ImageUploader) ExtractKeyFromURL(imageURL string) string {
	if imageURL == "" {
		return ""
	}

	trimmed := strings.TrimPrefix(imageURL, u.publicURL)
	trimmed = strings.TrimPrefix(trimmed, "/")
	return trimmed
}

// GetOptimizedURL returns the public URL for an existing object.
// R2 does not do on-the-fly transformations like Cloudinary; width/height are ignored
// unless you've enabled Cloudflare Image Resizing in front of this bucket/domain.
func (u *ImageUploader) GetOptimizedURL(key string, width, height int) (string, error) {
	if key == "" {
		return "", fmt.Errorf("key is required")
	}
	return u.publicURL + "/" + key, nil
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

// generateKey creates a unique object key for the image, namespaced under the folder
func (u *ImageUploader) generateKey(filename string) string {
	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, ext)
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "-", "_")

	timestamp := time.Now().Unix()
	base := fmt.Sprintf("%s_%d%s", name, timestamp, ext)

	if u.folder == "" {
		return base
	}
	return u.folder + "/" + base
}

// WithFolder creates a new uploader with a different folder
func (u *ImageUploader) WithFolder(folder string) *ImageUploader {
	return &ImageUploader{
		client:    u.client,
		bucket:    u.bucket,
		publicURL: u.publicURL,
		folder:    strings.Trim(folder, "/"),
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
