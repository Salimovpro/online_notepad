import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Download, Copy, Trash2, FileText, Search, Plus, Moon, Sun, Bold, Italic, Underline, List, Tag, Clock, SortAsc, SortDesc, Hash, Lock, Unlock, Share, Archive, Undo, Redo } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content: string;
  lastModified: Date;
  favorite?: boolean;
  tags: string[];
  format: {
    bold: boolean[];
    italic: boolean[];
    underline: boolean[];
  };
  isLocked?: boolean;
  password?: string;
  isArchived?: boolean;
  version?: number;
  history?: string[];
}

function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('notes');
    const parsedNotes = saved ? JSON.parse(saved) : [{
      id: '1',
      title: 'Welcome Note',
      content: 'Welcome to your enhanced notepad! Start typing...\n\nKeyboard shortcuts:\n- Ctrl/Cmd + N: New note\n- Ctrl/Cmd + S: Save note\n- Ctrl/Cmd + D: Download note\n- Ctrl/Cmd + F: Search notes\n- Ctrl/Cmd + B: Toggle bold\n- Ctrl/Cmd + I: Toggle italic\n- Ctrl/Cmd + U: Toggle underline\n- Ctrl/Cmd + Z: Undo\n- Ctrl/Cmd + Y: Redo',
      lastModified: new Date(),
      favorite: true,
      tags: ['welcome'],
      format: {
        bold: [false],
        italic: [false],
        underline: [false]
      },
      version: 1,
      history: []
    }];
    
    return parsedNotes.map(note => ({
      ...note,
      lastModified: new Date(note.lastModified)
    }));
  });

  const [activeNoteId, setActiveNoteId] = useState(notes[0].id);
  const [statusMessage, setStatusMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [sortOption, setSortOption] = useState<'modified' | 'title' | 'created' | 'archived'>('modified');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [newTag, setNewTag] = useState('');
  const [lastSaved, setLastSaved] = useState(new Date());
  const [password, setPassword] = useState('');
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes));
    setLastSaved(new Date());
  }, [notes]);

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        switch(e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            createNewNote();
            break;
          case 's':
            e.preventDefault();
            showStatus('Saved');
            break;
          case 'd':
            e.preventDefault();
            downloadNote();
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('search-input')?.focus();
            break;
          case 'b':
            e.preventDefault();
            toggleFormat('bold');
            break;
          case 'i':
            e.preventDefault();
            toggleFormat('italic');
            break;
          case 'u':
            e.preventDefault();
            toggleFormat('underline');
            break;
          case 'z':
            e.preventDefault();
            handleUndo();
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [activeNoteId, undoStack, redoStack]);

  const activeNote = notes.find(note => note.id === activeNoteId) || notes[0];

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      const searchLower = searchQuery.toLowerCase();
      const titleMatch = note.title.toLowerCase().includes(searchLower);
      const contentMatch = note.content.toLowerCase().includes(searchLower);
      const tagMatch = selectedTags.length === 0 || selectedTags.every(tag => note.tags.includes(tag));
      return (titleMatch || contentMatch) && tagMatch;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortOption) {
        case 'modified':
          comparison = new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created':
          comparison = parseInt(a.id) - parseInt(b.id);
          break;
        case 'archived':
          comparison = (b.isArchived ? 1 : 0) - (a.isArchived ? 1 : 0);
          break;
      }
      return sortDirection === 'desc' ? comparison : -comparison;
    });
  }, [notes, searchQuery, selectedTags, sortOption, sortDirection]);

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousContent = undoStack[undoStack.length - 1];
      const currentContent = activeNote.content;
      
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [...prev, currentContent]);
      
      updateNote(previousContent, false);
      showStatus('Undo');
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[redoStack.length - 1];
      const currentContent = activeNote.content;
      
      setRedoStack(prev => prev.slice(0, -1));
      setUndoStack(prev => [...prev, currentContent]);
      
      updateNote(nextContent, false);
      showStatus('Redo');
    }
  };

  const toggleLock = (id: string) => {
    if (!password) {
      showStatus('Please enter a password first');
      return;
    }

    const updatedNotes = notes.map(note =>
      note.id === id
        ? {
            ...note,
            isLocked: !note.isLocked,
            password: !note.isLocked ? password : undefined
          }
        : note
    );
    setNotes(updatedNotes);
    showStatus(updatedNotes.find(n => n.id === id)?.isLocked ? 'Note locked' : 'Note unlocked');
  };

  const toggleArchive = (id: string) => {
    const updatedNotes = notes.map(note =>
      note.id === id
        ? { ...note, isArchived: !note.isArchived }
        : note
    );
    setNotes(updatedNotes);
    showStatus(updatedNotes.find(n => n.id === id)?.isArchived ? 'Note archived' : 'Note unarchived');
  };

  const toggleFormat = (type: 'bold' | 'italic' | 'underline') => {
    const updatedNotes = notes.map(note =>
      note.id === activeNoteId
        ? {
            ...note,
            format: {
              ...note.format,
              [type]: [!note.format[type][0]]
            }
          }
        : note
    );
    setNotes(updatedNotes);
  };

  const updateNote = useCallback((content: string, addToHistory = true) => {
    if (addToHistory) {
      setUndoStack(prev => [...prev, activeNote.content]);
      setRedoStack([]);
    }

    const updatedNotes = notes.map(note => 
      note.id === activeNoteId 
        ? { 
            ...note, 
            content,
            title: content.split('\n')[0].slice(0, 50) || 'Untitled',
            lastModified: new Date(),
            version: (note.version || 1) + 1,
            history: [...(note.history || []), note.content]
          }
        : note
    );
    setNotes(updatedNotes);
  }, [activeNoteId, notes, activeNote]);

  const createNewNote = () => {
    const newNote = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      lastModified: new Date(),
      tags: [],
      format: {
        bold: [false],
        italic: [false],
        underline: [false]
      },
      version: 1,
      history: []
    };
    setNotes([...notes, newNote]);
    setActiveNoteId(newNote.id);
    showStatus('New note created');
  };

  const addTag = () => {
    if (newTag && !activeNote.tags.includes(newTag)) {
      const updatedNotes = notes.map(note =>
        note.id === activeNoteId
          ? { ...note, tags: [...note.tags, newTag] }
          : note
      );
      setNotes(updatedNotes);
      setNewTag('');
      showStatus('Tag added');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedNotes = notes.map(note =>
      note.id === activeNoteId
        ? { ...note, tags: note.tags.filter(tag => tag !== tagToRemove) }
        : note
    );
    setNotes(updatedNotes);
    showStatus('Tag removed');
  };

  const deleteNote = (id: string) => {
    if (notes.length === 1) {
      showStatus('Cannot delete the last note');
      return;
    }
    const updatedNotes = notes.filter(note => note.id !== id);
    setNotes(updatedNotes);
    setActiveNoteId(updatedNotes[0].id);
    showStatus('Note deleted');
  };

  const toggleFavorite = (id: string) => {
    const updatedNotes = notes.map(note =>
      note.id === id ? { ...note, favorite: !note.favorite } : note
    );
    setNotes(updatedNotes);
    showStatus(updatedNotes.find(n => n.id === id)?.favorite ? 'Added to favorites' : 'Removed from favorites');
  };

  const downloadNote = () => {
    const blob = new Blob([activeNote.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('Note downloaded');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(activeNote.content);
      showStatus('Copied to clipboard');
    } catch (err) {
      showStatus('Failed to copy');
    }
  };

  const showStatus = (message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 2000);
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    showStatus(`${!isDarkMode ? 'Dark' : 'Light'} mode enabled`);
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getCharacterCount = (text: string) => {
    return text.length;
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileText className={`h-6 w-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className="text-xl font-semibold">Enhanced Notepad</h1>
          </div>
          <div className="flex items-center space-x-4">
            {statusMessage && (
              <span className={`text-sm px-3 py-1 rounded-md ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                {statusMessage}
              </span>
            )}
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Last saved: {formatDistanceToNow(lastSaved, { addSuffix: true })}
            </span>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-md ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-72 flex-shrink-0">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-sm p-4`}>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={createNewNote}
                  className={`flex-1 flex items-center justify-center gap-2 ${
                    isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'
                  } text-white rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <Plus className="h-4 w-4" />
                  New Note
                </button>
              </div>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-md text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 focus:bg-gray-600 text-gray-100'
                      : 'bg-gray-50 focus:bg-white text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Sort by
                  </span>
                  <button
                    onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className={`p-1 rounded-md ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  >
                    {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  {(['modified', 'title', 'created', 'archived'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortOption(option)}
                      className={`px-3 py-1 rounded-md text-sm ${
                        sortOption === option
                          ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                          : isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTags(prev => 
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                      )}
                      className={`px-2 py-1 rounded-md text-sm flex items-center gap-1 ${
                        selectedTags.includes(tag)
                          ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                          : isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <Hash className="h-3 w-3" />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto">
                {filteredNotes.map(note => (
                  <div
                    key={note.id}
                    className={`flex justify-between items-center p-3 rounded-md cursor-pointer ${
                      note.id === activeNoteId 
                        ? isDarkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'
                        : isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    } ${note.isArchived ? 'opacity-50' : ''}`}
                    onClick={() => {
                      if (note.isLocked && note.password !== password) {
                        showStatus('Please enter the correct password');
                        return;
                      }
                      setActiveNoteId(note.id);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {note.title || 'Untitled'}
                        </p>
                        {note.isLocked && <Lock className="h-3 w-3 text-yellow-500" />}
                        {note.isArchived && <Archive className="h-3 w-3 text-gray-400" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {formatDistanceToNow(new Date(note.lastModified), { addSuffix: true })}
                        </p>
                        {note.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              {note.tags.length}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(note.id);
                        }}
                        className={`text-sm ${
                          note.favorite 
                            ? 'text-yellow-500' 
                            : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        ★
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLock(note.id);
                        }}
                        className={`${
                          isDarkMode ? 'text-gray-400 hover:text-yellow-400' : 'text-gray-400 hover:text-yellow-600'
                        }`}
                      >
                        {note.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleArchive(note.id);
                        }}
                        className={`${
                          isDarkMode ? 'text-gray-400 hover:text-blue-400' : 'text-gray-400 hover:text-blue-600'
                        }`}
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                        className={`${
                          isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-400 hover:text-red-600'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Editor */}
          <div className="flex-1">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-sm`}>
              <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} px-4 py-3`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-4">
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Last modified: {formatDistanceToNow(new Date(activeNote.lastModified), { addSuffix: true })}
                    </p>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {getWordCount(activeNote.content)} words, {getCharacterCount(activeNote.content)} characters
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Version: {activeNote.version || 1}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className={`p-2 rounded-md ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                      } ${undoStack.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Undo (Ctrl/Cmd + Z)"
                    >
                      <Undo className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={redoStack.length === 0}
                      className={`p-2 rounded-md ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                      } ${redoStack.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Redo (Ctrl/Cmd + Y)"
                    >
                      <Redo className="h-5 w-5" />
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className={`p-2 rounded-md ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                      title="Copy to clipboard"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                    <button
                      onClick={downloadNote}
                      className={`p-2 rounded-md ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                      title="Download note"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => showStatus('Auto-saved')}
                      className={`p-2 rounded-md ${
                        isDarkMode 
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                      }`}
                      title="Save"
                    >
                      <Save className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFormat('bold')}
                      className={`p-2 rounded-md ${
                        activeNote.format.bold[0]
                          ? isDarkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'
                          : isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Bold (Ctrl/Cmd + B)"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleFormat('italic')}
                      className={`p-2 rounded-md ${
                        activeNote.format.italic[0]
                          ? isDarkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'
                          : isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Italic (Ctrl/Cmd + I)"
                    >
                      <Italic className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleFormat('underline')}
                      className={`p-2 rounded-md ${
                        activeNote.format.underline[0]
                          ? isDarkMode ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'
                          : isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title="Underline (Ctrl/Cmd + U)"
                    >
                      <Underline className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set password..."
                      className={`w-32 px-3 py-1 rounded-md text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 text-gray-100'
                          : 'bg-gray-50 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    <div className="relative">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag..."
                        className={`w-32 px-3 py-1 rounded-md text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 text-gray-100'
                            : 'bg-gray-50 text-gray-900'
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`} onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <button
                        onClick={addTag}
                        className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {activeNote.tags.map(tag => (
                      <span
                        key={tag}
                        className={`px-2 py-1 rounded-md text-sm flex items-center gap-1 ${
                          isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Hash className="h-3 w-3" />
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <textarea
                value={activeNote.content}
                onChange={(e) => updateNote(e.target.value)}
                className={`w-full h-[calc(100vh-24rem)] p-4 focus:outline-none resize-none ${
                  isDarkMode 
                    ? 'bg-gray-800 text-gray-100' 
                    : 'bg-white text-gray-900'
                } ${
                  activeNote.format.bold[0] ? 'font-bold' : ''
                } ${
                  activeNote.format.italic[0] ? 'italic' : ''
                } ${
                  activeNote.format.underline[0] ? 'underline' : ''
                }`}
                placeholder="Start typing..."
                disabled={activeNote.isLocked && activeNote.password !== password}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;