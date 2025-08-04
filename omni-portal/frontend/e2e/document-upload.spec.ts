import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Document Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'fake-jwt-token');
    });

    // Mock document validation progress
    await page.route('**/api/documents/validation-progress', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            progress: {
              rg: { uploaded: false, status: 'missing', required: true },
              cpf: { uploaded: false, status: 'missing', required: true },
              comprovante_residencia: { uploaded: false, status: 'missing', required: true },
              foto_3x4: { uploaded: false, status: 'missing', required: true }
            },
            overall_percentage: 0,
            completed_documents: 0,
            total_required: 4
          }
        })
      });
    });

    await page.goto('/document-upload');
  });

  test('should display document upload interface correctly', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Upload de Documentos');
    
    // Should show all required document types
    await expect(page.locator('text=RG ou CNH')).toBeVisible();
    await expect(page.locator('text=CPF')).toBeVisible();
    await expect(page.locator('text=Comprovante de Residência')).toBeVisible();
    await expect(page.locator('text=Foto 3x4')).toBeVisible();

    // Should show overall progress
    await expect(page.locator('text=0% concluído')).toBeVisible();
    await expect(page.locator('text=0 de 4 documentos aprovados')).toBeVisible();
  });

  test('should upload RG document successfully', async ({ page }) => {
    // Mock successful upload
    await page.route('**/api/documents/upload', async route => {
      const request = route.request();
      const method = request.method();
      
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 1,
              type: 'rg',
              status: 'processing',
              file_path: 'documents/1/rg.jpg',
              created_at: new Date().toISOString()
            }
          })
        });
      }
    });

    // Create a test file
    const fileContent = Buffer.from('fake RG image content');
    
    // Find the RG upload section and upload file
    const rgSection = page.locator('[data-testid="document-section-rg"]');
    await expect(rgSection).toBeVisible();
    
    const fileInput = rgSection.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'rg.jpg',
      mimeType: 'image/jpeg',
      buffer: fileContent
    });

    // Click upload button
    await rgSection.locator('button:has-text("Upload")').click();

    // Should show success message
    await expect(page.locator('text=Upload realizado com sucesso')).toBeVisible();
    
    // Should show processing status
    await expect(page.locator('text=Processando documento...')).toBeVisible();
    
    // Progress should update
    await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '25');
  });

  test('should validate file size and type', async ({ page }) => {
    const rgSection = page.locator('[data-testid="document-section-rg"]');
    
    // Test file too large (>10MB)
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          errors: {
            file: ['O arquivo deve ter no máximo 10MB']
          }
        })
      });
    });

    const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const fileInput = rgSection.locator('input[type="file"]');
    
    await fileInput.setInputFiles({
      name: 'large-rg.jpg',
      mimeType: 'image/jpeg',
      buffer: largeFile
    });

    await rgSection.locator('button:has-text("Upload")').click();
    
    // Should show error message
    await expect(page.locator('text=O arquivo deve ter no máximo 10MB')).toBeVisible();
  });

  test('should handle invalid file types', async ({ page }) => {
    const rgSection = page.locator('[data-testid="document-section-rg"]');
    
    // Mock validation error for invalid file type
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          errors: {
            file: ['Apenas arquivos JPG, PNG e PDF são aceitos']
          }
        })
      });
    });

    const fileInput = rgSection.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('invalid file content')
    });

    await rgSection.locator('button:has-text("Upload")').click();
    
    await expect(page.locator('text=Apenas arquivos JPG, PNG e PDF são aceitos')).toBeVisible();
  });

  test('should show OCR processing and validation results', async ({ page }) => {
    // Upload document first
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            type: 'rg',
            status: 'processing',
            file_path: 'documents/1/rg.jpg'
          }
        })
      });
    });

    const rgSection = page.locator('[data-testid="document-section-rg"]');
    const fileInput = rgSection.locator('input[type="file"]');
    
    await fileInput.setInputFiles({
      name: 'rg.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake RG content')
    });

    await rgSection.locator('button:has-text("Upload")').click();

    // Simulate OCR completion
    await page.route('**/api/documents/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            type: 'rg',
            status: 'approved',
            ocr_data: {
              name: 'JOÃO SILVA SANTOS',
              rg_number: '12.345.678-9',
              birth_date: '15/05/1990'
            },
            ocr_confidence: 0.95,
            validation_results: {
              is_valid: true,
              confidence_score: 90
            }
          }
        })
      });
    });

    // Check document after processing
    await page.click('button:has-text("Verificar Status")');

    // Should show extracted data
    await expect(page.locator('text=JOÃO SILVA SANTOS')).toBeVisible();
    await expect(page.locator('text=12.345.678-9')).toBeVisible();
    await expect(page.locator('text=15/05/1990')).toBeVisible();
    
    // Should show approval status
    await expect(page.locator('text=Documento aprovado')).toBeVisible();
    await expect(page.locator('[data-testid="document-status-approved"]')).toBeVisible();
  });

  test('should handle document rejection with explanation', async ({ page }) => {
    // Upload document
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, type: 'rg', status: 'processing' }
        })
      });
    });

    const rgSection = page.locator('[data-testid="document-section-rg"]');
    const fileInput = rgSection.locator('input[type="file"]');
    
    await fileInput.setInputFiles({
      name: 'rg.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake content')
    });

    await rgSection.locator('button:has-text("Upload")').click();

    // Simulate rejection
    await page.route('**/api/documents/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            type: 'rg',
            status: 'rejected',
            rejection_reason: 'Nome no documento não confere com o cadastro',
            validation_results: {
              is_valid: false,
              errors: ['Nome no documento não confere com o cadastro'],
              confidence_score: 45
            }
          }
        })
      });
    });

    await page.click('button:has-text("Verificar Status")');

    // Should show rejection reason
    await expect(page.locator('text=Documento rejeitado')).toBeVisible();
    await expect(page.locator('text=Nome no documento não confere')).toBeVisible();
    
    // Should show retry option
    await expect(page.locator('button:has-text("Enviar Novo Documento")')).toBeVisible();
  });

  test('should allow drag and drop file upload', async ({ page }) => {
    const rgSection = page.locator('[data-testid="document-section-rg"]');
    const dropZone = rgSection.locator('[data-testid="drop-zone"]');
    
    await expect(dropZone).toBeVisible();
    await expect(page.locator('text=Arraste e solte ou clique para selecionar')).toBeVisible();

    // Simulate drag and drop
    const fileContent = Buffer.from('fake RG content');
    
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, type: 'rg', status: 'processing' }
        })
      });
    });

    // Simulate file drop
    await dropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [{
          name: 'rg.jpg',
          type: 'image/jpeg',
          size: fileContent.length
        }]
      }
    });

    await expect(page.locator('text=Upload realizado com sucesso')).toBeVisible();
  });

  test('should track progress for all document types', async ({ page }) => {
    // Upload multiple documents
    const documentTypes = ['rg', 'cpf', 'comprovante_residencia', 'foto_3x4'];
    
    for (let i = 0; i < documentTypes.length; i++) {
      const docType = documentTypes[i];
      
      await page.route('**/api/documents/upload', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: i + 1,
              type: docType,
              status: 'approved'
            }
          })
        });
      });

      // Update progress mock
      await page.route('**/api/documents/validation-progress', async route => {
        const progress = {};
        for (let j = 0; j <= i; j++) {
          const docType = documentTypes[j];
          if (docType) {
            progress[docType] = {
              uploaded: true,
              status: 'approved',
              required: true
            };
          }
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              progress,
              overall_percentage: ((i + 1) / 4) * 100,
              completed_documents: i + 1,
              total_required: 4
            }
          })
        });
      });

      const section = page.locator(`[data-testid="document-section-${docType}"]`);
      const fileInput = section.locator('input[type="file"]');
      
      await fileInput.setInputFiles({
        name: `${docType}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from(`fake ${docType} content`)
      });

      await section.locator('button:has-text("Upload")').click();
      
      // Check progress update
      const expectedPercentage = ((i + 1) / 4) * 100;
      await expect(page.locator(`text=${expectedPercentage}% concluído`)).toBeVisible();
    }

    // All documents uploaded - should show completion
    await expect(page.locator('text=100% concluído')).toBeVisible();
    await expect(page.locator('text=4 de 4 documentos aprovados')).toBeVisible();
    await expect(page.locator('button:has-text("Continuar para Entrevista")')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network error
    await page.route('**/api/documents/upload', async route => {
      await route.abort('failed');
    });

    const rgSection = page.locator('[data-testid="document-section-rg"]');
    const fileInput = rgSection.locator('input[type="file"]');
    
    await fileInput.setInputFiles({
      name: 'rg.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake content')
    });

    await rgSection.locator('button:has-text("Upload")').click();

    // Should show error message
    await expect(page.locator('text=Erro no upload')).toBeVisible();
    await expect(page.locator('button:has-text("Tentar Novamente")')).toBeVisible();
  });

  test('should work correctly on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Should show mobile-optimized layout
    await expect(page.locator('[data-testid="mobile-upload-interface"]')).toBeVisible();
    
    // Document sections should stack vertically
    const documentSections = page.locator('[data-testid^="document-section-"]');
    await expect(documentSections).toHaveCount(4);
    
    // Upload should work on mobile
    const rgSection = page.locator('[data-testid="document-section-rg"]');
    const fileInput = rgSection.locator('input[type="file"]');
    
    await page.route('**/api/documents/upload', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1, type: 'rg', status: 'processing' }
        })
      });
    });

    await fileInput.setInputFiles({
      name: 'rg.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('mobile upload test')
    });

    await rgSection.locator('button:has-text("Upload")').click();
    await expect(page.locator('text=Upload realizado com sucesso')).toBeVisible();
  });

  test('should show helpful tips and guidance', async ({ page }) => {
    // Should show upload tips
    await expect(page.locator('text=Dicas para um bom upload')).toBeVisible();
    await expect(page.locator('text=Mantenha a imagem nítida')).toBeVisible();
    await expect(page.locator('text=Evite reflexos e sombras')).toBeVisible();
    await expect(page.locator('text=Máximo 10MB por arquivo')).toBeVisible();

    // Should show document examples
    await page.click('button:has-text("Ver Exemplo")');
    await expect(page.locator('[data-testid="document-example-modal"]')).toBeVisible();
    await expect(page.locator('img[alt*="exemplo"]')).toBeVisible();
  });
});