# Test Fixtures

This directory contains test files used in E2E tests.

## Required Files

The E2E tests expect the following test files to be present:

- `test-id.jpg` - Sample ID document image
- `test-passport.jpg` - Sample passport image  
- `test-drivers-license.jpg` - Sample driver's license image
- `test-birth-certificate.jpg` - Sample birth certificate image
- `test-address-proof.jpg` - Sample address proof document
- `test-id-with-text.jpg` - ID document with readable text for OCR testing
- `test-id-replacement.jpg` - Alternative ID document for replacement testing
- `test-document.txt` - Text file for file type validation testing

## Creating Test Files

You can create these test files by:

1. Using sample documents (with sensitive information removed/redacted)
2. Creating simple images with text using image editing software
3. Generating placeholder images programmatically

## Important Notes

- **Never use real personal documents** in test fixtures
- All test files should be anonymized/fake data only
- Keep file sizes reasonable (< 5MB) for faster test execution
- Ensure test files have appropriate extensions and MIME types

## Example Commands

Create placeholder test images:

```bash
# Create a simple colored rectangle as test image
convert -size 800x600 xc:lightblue test-id.jpg
convert -size 800x600 xc:lightgreen test-passport.jpg
convert -size 800x600 xc:lightyellow test-drivers-license.jpg
```

Or use existing sample images from the project's public assets.