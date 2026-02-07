
import React, { useState, useRef, useEffect } from 'react';
import { Note, NoteBlock, User, LLMConfig, NoteBlockType } from '../types';
import { generateNoteSummary } from '../services/llmService';
import { 
    Plus, Archive, Trash2, Search, FileText, Image as ImageIcon, 
    Square, Circle, Minus, Type, X, Bot, Loader2, Calendar, MousePointer2, Pen
} from 'lucide-react';

interface NotesManagerProps {
    notes: Note[];
    currentUser: User | null;
    llmConfig: LLMConfig;
    onUpdateNote: (note: Note) => void;
    onDeleteNote: (id: string) => void;
}

const NotesManager: React.FC<NotesManagerProps> = ({ notes, currentUser, llmConfig, onUpdateNote, onDeleteNote }) => {
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    
    // AI State
    const [isGenerating, setIsGenerating] = useState(false);
    const [includeImagesInSummary, setIncludeImagesInSummary] = useState(false);

    // Canvas Interaction State
    const [activeTool, setActiveTool] = useState<NoteBlockType | 'select' | 'pen'>('select');
    const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    
    // Drawing State
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState('');
    
    // Refs
    const notesRef = useRef(notes); // Keep track of latest notes for async ops
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Update ref when notes change
    useEffect(() => {
        notesRef.current = notes;
    }, [notes]);

    // Initial Empty Note Logic
    const createNewNote = () => {
        const newNote: Note = {
            id: Date.now().toString(),
            userId: currentUser?.id || '',
            title: 'New Note',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isArchived: false,
            blocks: []
        };
        onUpdateNote(newNote);
        setSelectedNoteId(newNote.id);
    };

    const selectedNote = notes.find(n => n.id === selectedNoteId);

    // --- Block Manipulation ---

    const updateNoteTitle = (title: string) => {
        if (!selectedNote) return;
        onUpdateNote({ ...selectedNote, title, updatedAt: new Date().toISOString() });
    };

    const addBlock = (type: NoteBlockType, content?: string, position?: {x: number, y: number}) => {
        // Use logic that depends on 'selectedNote' from render scope for immediate user interactions
        if (!selectedNote) return;
        
        // Default pos center of visible area if not provided
        const defaultPos = position || { x: 100, y: 100 };

        const newBlock: NoteBlock = {
            id: Date.now().toString(),
            type,
            content: content || '',
            position: defaultPos,
            style: type === 'rectangle' ? { width: '150px', height: '100px', color: '#6366f1' } :
                   type === 'circle' ? { width: '100px', height: '100px', color: '#ec4899' } :
                   type === 'line' ? { width: '200px', height: '4px', color: '#94a3b8' } :
                   type === 'drawing' ? { color: '#000000', width: '2' } : undefined
        };
        onUpdateNote({
            ...selectedNote,
            blocks: [...selectedNote.blocks, newBlock],
            updatedAt: new Date().toISOString()
        });
        setActiveTool('select'); // Switch back to select after adding
    };

    const updateBlock = (blockId: string, updates: Partial<NoteBlock>) => {
        if (!selectedNote) return;
        const newBlocks = selectedNote.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
        onUpdateNote({ ...selectedNote, blocks: newBlocks, updatedAt: new Date().toISOString() });
    };

    const removeBlock = (blockId: string) => {
        if (!selectedNote) return;
        const newBlocks = selectedNote.blocks.filter(b => b.id !== blockId);
        onUpdateNote({ ...selectedNote, blocks: newBlocks, updatedAt: new Date().toISOString() });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                const content = evt.target?.result as string;
                addBlock('image', content);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Mouse Handling (Drag & Draw) ---

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + canvasRef.current.scrollLeft;
        const y = e.clientY - rect.top + canvasRef.current.scrollTop;

        if (activeTool === 'pen') {
            setIsDrawing(true);
            setCurrentPath(`M ${x} ${y}`);
        } else if (activeTool !== 'select') {
            // Add shape at click
            if (activeTool === 'text') addBlock('text', '', {x, y});
            else if (activeTool === 'rectangle') addBlock('rectangle', '', {x, y});
            else if (activeTool === 'circle') addBlock('circle', '', {x, y});
            else if (activeTool === 'line') addBlock('line', '', {x, y});
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + canvasRef.current.scrollLeft;
        const y = e.clientY - rect.top + canvasRef.current.scrollTop;

        if (isDrawing) {
            setCurrentPath(prev => `${prev} L ${x} ${y}`);
        } else if (draggingBlockId && activeTool === 'select') {
            updateBlock(draggingBlockId, {
                position: {
                    x: x - dragOffset.x,
                    y: y - dragOffset.y
                }
            });
        }
    };

    const handleMouseUp = () => {
        if (isDrawing) {
            setIsDrawing(false);
            if (currentPath.length > 10) {
                addBlock('drawing', currentPath, {x: 0, y: 0}); // Drawing path coords are absolute to canvas
            }
            setCurrentPath('');
        }
        setDraggingBlockId(null);
    };

    const startDrag = (e: React.MouseEvent, block: NoteBlock) => {
        if (activeTool !== 'select') return;
        e.stopPropagation(); // Prevent canvas click
        setDraggingBlockId(block.id);
        
        // Calculate offset
        if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + canvasRef.current.scrollLeft;
            const mouseY = e.clientY - rect.top + canvasRef.current.scrollTop;
            setDragOffset({
                x: mouseX - block.position.x,
                y: mouseY - block.position.y
            });
        }
    };

    // --- AI Summary ---

    const handleGenerateSummary = async () => {
        // Capture ID to find note later
        const noteId = selectedNoteId;
        // Use current note for prompt generation
        const noteForPrompt = notesRef.current.find(n => n.id === noteId);
        
        if (!noteForPrompt) return;
        setIsGenerating(true);
        try {
            const summary = await generateNoteSummary(noteForPrompt, includeImagesInSummary, llmConfig);
            
            // Re-fetch the latest state of the note using ref to avoid stale closures if user edited during generation
            const freshNote = notesRef.current.find(n => n.id === noteId);
            if (freshNote) {
                const maxY = freshNote.blocks.reduce((max, b) => Math.max(max, b.position.y + 100), 0);
                const newBlock: NoteBlock = {
                    id: Date.now().toString(),
                    type: 'text',
                    content: `\n**AI SUMMARY:**\n${summary}`,
                    position: { x: 50, y: maxY + 50 },
                };
                onUpdateNote({
                    ...freshNote,
                    blocks: [...freshNote.blocks, newBlock],
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            alert("Error generating summary.");
        } finally {
            setIsGenerating(false);
        }
    };

    // --- Filtering ---
    const filteredNotes = notes
        .filter(n => n.userId === currentUser?.id)
        .filter(n => showArchived ? n.isArchived : !n.isArchived)
        .filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return (
        <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto gap-6">
            
            {/* Sidebar List */}
            <div className="w-1/4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-lg text-slate-900 dark:text-white">My Notes</h2>
                        <button onClick={createNewNote} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="showArchived" 
                            checked={showArchived} 
                            onChange={e => setShowArchived(e.target.checked)} 
                            className="rounded text-indigo-600"
                        />
                        <label htmlFor="showArchived" className="text-xs text-slate-500 dark:text-slate-400 font-medium">Archived</label>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredNotes.map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => setSelectedNoteId(note.id)}
                            className={`p-3 rounded-xl cursor-pointer transition-colors border ${selectedNoteId === note.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <h3 className={`font-bold text-sm mb-1 ${selectedNoteId === note.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{note.title}</h3>
                            <p className="text-[10px] text-slate-400 flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(note.updatedAt).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                    {filteredNotes.length === 0 && <div className="p-4 text-center text-slate-400 text-xs italic">No notes found.</div>}
                </div>
            </div>

            {/* Editor Canvas */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden relative">
                {selectedNote ? (
                    <>
                        {/* Note Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-900 z-10">
                            <div className="flex-1 mr-4">
                                <input 
                                    type="text" 
                                    value={selectedNote.title}
                                    onChange={e => updateNoteTitle(e.target.value)}
                                    className="text-2xl font-bold bg-transparent outline-none w-full text-slate-900 dark:text-white placeholder-slate-300"
                                    placeholder="Note Title..."
                                />
                                <div className="text-xs text-slate-400 mt-1">Created: {new Date(selectedNote.createdAt).toLocaleDateString()}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => onUpdateNote({ ...selectedNote, isArchived: !selectedNote.isArchived })}
                                    className={`p-2 rounded-lg transition-colors ${selectedNote.isArchived ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                    title={selectedNote.isArchived ? "Unarchive" : "Archive"}
                                >
                                    <Archive className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => { onDeleteNote(selectedNote.id); setSelectedNoteId(null); }}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* AI Toolbar */}
                        <div className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between z-10">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        id="includeImages" 
                                        checked={includeImagesInSummary}
                                        onChange={e => setIncludeImagesInSummary(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="includeImages" className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 cursor-pointer">Include Images</label>
                                </div>
                            </div>
                            <button 
                                onClick={handleGenerateSummary}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                                {isGenerating ? 'Analyzing...' : 'Generate AI Summary'}
                            </button>
                        </div>

                        {/* CANVAS AREA */}
                        <div 
                            ref={canvasRef}
                            className={`flex-1 relative overflow-auto bg-slate-50 dark:bg-slate-950 bg-grid-slate-200 dark:bg-grid-slate-800 [background-size:20px_20px] ${activeTool === 'pen' ? 'cursor-crosshair' : activeTool !== 'select' ? 'cursor-copy' : 'cursor-default'}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            {/* Drawing Layer (Top SVG) */}
                            {isDrawing && (
                                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{zIndex: 50}}>
                                    <path d={currentPath} stroke="black" strokeWidth="2" fill="none" className="dark:stroke-white" />
                                </svg>
                            )}

                            {selectedNote.blocks.map((block) => (
                                <div 
                                    key={block.id} 
                                    className="absolute group"
                                    style={{ 
                                        left: block.position.x, 
                                        top: block.position.y,
                                        zIndex: block.type === 'drawing' ? 0 : 10 // Drawings at back, items at front
                                    }}
                                    onMouseDown={(e) => startDrag(e, block)}
                                >
                                    {/* Handle for selecting/moving clearly */}
                                    <div className={`absolute -top-3 -left-3 p-1 rounded-full bg-indigo-500 cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-20 ${activeTool === 'select' ? '' : 'hidden'}`}></div>

                                    {/* Delete Block Button */}
                                    {activeTool === 'select' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                                            className="absolute -top-4 -right-4 p-1 bg-white dark:bg-slate-800 shadow-sm border border-red-200 rounded-full text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}

                                    {/* Render Block based on Type */}
                                    {block.type === 'text' && (
                                        <textarea
                                            value={block.content}
                                            onChange={(e) => {
                                                updateBlock(block.id, { content: e.target.value });
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            className={`bg-transparent border border-transparent hover:border-dashed hover:border-slate-300 rounded p-1 outline-none resize-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed overflow-hidden min-w-[200px] ${activeTool === 'select' ? 'cursor-move' : ''}`}
                                            placeholder="Type here..."
                                            rows={1}
                                            style={{ minHeight: '1.5em' }}
                                            onClick={e => e.stopPropagation()} // Allow text edit
                                        />
                                    )}

                                    {block.type === 'image' && (
                                        <img src={block.content} alt="Note content" className="max-w-[300px] rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 pointer-events-none" />
                                    )}

                                    {block.type === 'rectangle' && (
                                        <div 
                                            style={{ 
                                                width: block.style?.width, 
                                                height: block.style?.height, 
                                                borderColor: block.style?.color,
                                                backgroundColor: `${block.style?.color}20`,
                                                borderWidth: '4px',
                                                borderStyle: 'solid'
                                            }} 
                                        />
                                    )}

                                    {block.type === 'circle' && (
                                        <div 
                                            style={{ 
                                                width: block.style?.width, 
                                                height: block.style?.height, 
                                                borderColor: block.style?.color,
                                                backgroundColor: `${block.style?.color}20`,
                                                borderWidth: '4px',
                                                borderStyle: 'solid',
                                                borderRadius: '50%'
                                            }} 
                                        />
                                    )}

                                    {block.type === 'line' && (
                                        <div 
                                            style={{ 
                                                width: block.style?.width, 
                                                height: block.style?.height, 
                                                backgroundColor: block.style?.color 
                                            }} 
                                        />
                                    )}

                                    {block.type === 'drawing' && (
                                        <svg style={{ overflow: 'visible' }}>
                                            <path 
                                                d={block.content} 
                                                stroke={block.style?.color || 'black'} 
                                                strokeWidth={block.style?.width || '2'} 
                                                fill="none" 
                                                className="dark:stroke-white"
                                            />
                                        </svg>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Floating Toolbar */}
                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-full px-4 py-2 flex items-center gap-2 z-20">
                            <button 
                                onClick={() => setActiveTool('select')} 
                                className={`p-2 rounded-full transition-colors ${activeTool === 'select' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} 
                                title="Select / Move"
                            >
                                <MousePointer2 className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => setActiveTool('pen')} 
                                className={`p-2 rounded-full transition-colors ${activeTool === 'pen' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} 
                                title="Pen"
                            >
                                <Pen className="w-5 h-5" />
                            </button>
                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                            <button onClick={() => setActiveTool('text')} className={`p-2 rounded-full transition-colors ${activeTool === 'text' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Text">
                                <Type className="w-5 h-5" />
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300" title="Image">
                                <ImageIcon className="w-5 h-5" />
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                            <button onClick={() => setActiveTool('rectangle')} className={`p-2 rounded-full transition-colors ${activeTool === 'rectangle' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Rectangle">
                                <Square className="w-5 h-5" />
                            </button>
                            <button onClick={() => setActiveTool('circle')} className={`p-2 rounded-full transition-colors ${activeTool === 'circle' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Circle">
                                <Circle className="w-5 h-5" />
                            </button>
                            <button onClick={() => setActiveTool('line')} className={`p-2 rounded-full transition-colors ${activeTool === 'line' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'}`} title="Line">
                                <Minus className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <FileText className="w-16 h-16 mb-4 opacity-20" />
                        <p>Select a note or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesManager;