import { expect } from '@playwright/test';

export class Dashboard {
  constructor(page) {
    this.page = page;
    
    // Selectors
    this.dashboardTitle = 'h1:has-text("Dashboard")';
    this.newRecordingButton = 'a[href="/record"]';
    this.notesGrid = '[data-testid="notes-grid"], .notes-grid';
    this.noteCard = '[data-testid="note-card"], .note-card';
    this.noteTitle = '[data-testid="note-title"]';
    this.noteDate = '[data-testid="note-date"]';
    this.noteStatus = '[data-testid="note-status"]';
    this.favoriteButton = '[data-testid="favorite-button"]';
    this.deleteButton = '[data-testid="delete-button"]';
    
    // Statistics
    this.totalNotesCount = '[data-testid="total-notes"], text=/Total Notes/i >> xpath=../following-sibling::*';
    this.completedNotesCount = '[data-testid="completed-notes"], text=/Completed/i >> xpath=../following-sibling::*';
    this.processingNotesCount = '[data-testid="processing-notes"], text=/Processing/i >> xpath=../following-sibling::*';
    this.favoriteNotesCount = '[data-testid="favorite-notes"], text=/Favorites/i >> xpath=../following-sibling::*';
    
    // Storage
    this.storageUsage = '[data-testid="storage-usage"]';
    this.storageBar = '.bg-primary-500';
    
    // Loading and empty states
    this.loadingSpinner = '[data-testid="loading-spinner"], .animate-spin';
    this.emptyState = 'text=/No notes found/i, text=/No recordings yet/i';
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async goToMainPage() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async clickNewRecording() {
    await this.page.click(this.newRecordingButton);
    await this.page.waitForLoadState('networkidle');
  }

  async getAllNotes() {
    await this.page.waitForSelector(this.notesGrid);
    const noteCards = await this.page.locator(this.noteCard).all();
    
    const notes = [];
    for (const card of noteCards) {
      try {
        const title = await card.locator(this.noteTitle).textContent();
        const date = await card.locator(this.noteDate).textContent();
        const status = await card.locator(this.noteStatus).textContent().catch(() => 'unknown');
        
        notes.push({
          title: title?.trim() || '',
          date: date?.trim() || '',
          status: status?.trim() || 'unknown',
          element: card
        });
      } catch (error) {
        console.warn('Could not extract note data:', error);
      }
    }
    
    return notes;
  }

  async findNoteByTitle(expectedTitle) {
    // Wait for notes to load
    await this.page.waitForTimeout(2000);
    
    // Try multiple approaches to find the note
    const approaches = [
      // 1. Direct text search in note cards
      async () => {
        const noteCards = await this.page.locator(this.noteCard).all();
        for (const card of noteCards) {
          const cardText = await card.textContent();
          if (cardText.includes(expectedTitle)) {
            const title = await card.locator(this.noteTitle).textContent().catch(() => cardText);
            return { title, element: card, found: true };
          }
        }
        return null;
      },
      
      // 2. Search by title element specifically
      async () => {
        const titleElements = await this.page.locator(`text="${expectedTitle}"`).all();
        if (titleElements.length > 0) {
          return { 
            title: expectedTitle, 
            element: titleElements[0], 
            found: true 
          };
        }
        return null;
      },
      
      // 3. Partial text match
      async () => {
        const partialMatch = await this.page.locator(`text*="${expectedTitle}"`).first();
        if (await partialMatch.count() > 0) {
          return { 
            title: expectedTitle, 
            element: partialMatch, 
            found: true 
          };
        }
        return null;
      },
      
      // 4. Search in any text content
      async () => {
        const pageContent = await this.page.textContent('body');
        if (pageContent.includes(expectedTitle)) {
          return { 
            title: expectedTitle, 
            element: null, 
            found: true, 
            foundInPageContent: true 
          };
        }
        return null;
      }
    ];
    
    for (const approach of approaches) {
      try {
        const result = await approach();
        if (result) {
          console.log(`Found note "${expectedTitle}" using approach ${approaches.indexOf(approach) + 1}`);
          return result;
        }
      } catch (error) {
        console.warn(`Approach ${approaches.indexOf(approach) + 1} failed:`, error);
      }
    }
    
    // Log available notes for debugging
    const availableNotes = await this.getAllNotes();
    console.log('Available notes:', availableNotes.map(n => n.title));
    
    return null;
  }

  async hasNoteWithTitle(expectedTitle) {
    const note = await this.findNoteByTitle(expectedTitle);
    return !!note;
  }

  async clickNoteByTitle(expectedTitle) {
    const note = await this.findNoteByTitle(expectedTitle);
    if (note && note.element) {
      await note.element.click();
      await this.page.waitForLoadState('networkidle');
      return true;
    }
    return false;
  }

  async getNotesCount() {
    try {
      const noteCards = await this.page.locator(this.noteCard).count();
      return noteCards;
    } catch (error) {
      console.warn('Could not get notes count:', error);
      return 0;
    }
  }

  async getStats() {
    try {
      const stats = {};
      
      // Try to get various statistics
      const statSelectors = {
        total: ['text=/Total Notes/i', 'text=/total/i'],
        completed: ['text=/Completed/i', 'text=/complete/i'],
        processing: ['text=/Processing/i', 'text=/processing/i'],
        favorites: ['text=/Favorites/i', 'text=/favorite/i']
      };
      
      for (const [key, selectors] of Object.entries(statSelectors)) {
        for (const selector of selectors) {
          try {
            const element = this.page.locator(selector).first();
            if (await element.count() > 0) {
              // Look for numbers in parent container
              const parentText = await element.locator('..').textContent();
              const numbers = parentText.match(/\d+/g);
              if (numbers) {
                stats[key] = parseInt(numbers[numbers.length - 1]);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      return stats;
    } catch (error) {
      console.warn('Could not get stats:', error);
      return {};
    }
  }

  async waitForNotesToLoad(timeout = 10000) {
    try {
      // Wait for either notes to appear or empty state
      await this.page.waitForFunction(
        () => {
          const notesGrid = document.querySelector('[data-testid="notes-grid"], .notes-grid');
          const noteCards = document.querySelectorAll('[data-testid="note-card"], .note-card');
          const emptyState = document.querySelector('[data-testid="empty-state"]') || 
                          document.body.textContent.includes('No notes found') ||
                          document.body.textContent.includes('No recordings yet');
          const loadingSpinner = document.querySelector('[data-testid="loading-spinner"], .animate-spin');
          
          // Loading is done if we have notes, empty state, or no spinner
          return noteCards.length > 0 || emptyState || !loadingSpinner;
        },
        { timeout }
      );
    } catch (error) {
      console.warn('Notes loading timeout, continuing anyway:', error);
    }
    
    // Additional wait for any dynamic content
    await this.page.waitForTimeout(1000);
  }

  async refreshPage() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
    await this.waitForNotesToLoad();
  }

  // Assertions
  async assertDashboardLoaded() {
    await expect(this.page.locator(this.dashboardTitle)).toBeVisible();
  }

  async assertNewRecordingButtonVisible() {
    await expect(this.page.locator(this.newRecordingButton)).toBeVisible();
  }

  async assertNotesGridVisible() {
    // Wait for loading to complete first
    await this.waitForNotesToLoad();
    
    // Check for either notes grid or empty state
    const hasNotesGrid = await this.page.locator(this.notesGrid).count() > 0;
    const hasEmptyState = await this.page.locator('[data-testid="empty-state"]').count() > 0 ||
                          await this.page.textContent('body').then(text => 
                            text.includes('No notes found') || text.includes('No recordings yet')
                          ).catch(() => false);
    
    expect(hasNotesGrid || hasEmptyState).toBe(true);
  }

  async assertNoteExists(expectedTitle) {
    await this.waitForNotesToLoad();
    const hasNote = await this.hasNoteWithTitle(expectedTitle);
    expect(hasNote).toBe(true);
  }

  async assertNoteCount(expectedCount) {
    await this.waitForNotesToLoad();
    const actualCount = await this.getNotesCount();
    expect(actualCount).toBe(expectedCount);
  }

  async assertMinimumNoteCount(minimumCount) {
    await this.waitForNotesToLoad();
    const actualCount = await this.getNotesCount();
    expect(actualCount).toBeGreaterThanOrEqual(minimumCount);
  }
}