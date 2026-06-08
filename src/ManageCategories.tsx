import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiCheck, FiX } from 'react-icons/fi';
import { useAuth } from './context/AuthContext';
import { syncCategories } from './services/supabaseSync';
import { logCategoryManaged } from './config/analyticsEvents';

export default function ManageCategories() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('categories') || '[]');
    setCategories(stored);
  }, []);

  const save = (list: string[]) => {
    setCategories(list);
    localStorage.setItem('categories', JSON.stringify(list));

    if (user?.uid) {
      const categoriesForSync = list.map((cat) => ({
        id: cat,
        name: cat,
      }));

      syncCategories(user.uid, categoriesForSync).catch((err) => {
        console.warn('⚠️ Failed to sync categories to Supabase:', err);
      });
    }
  };

  const add = () => {
    const c = newCat.trim();
    if (c && !categories.includes(c)) {
      save([...categories, c]);
      logCategoryManaged('added', c);
      setNewCat('');
    }
  };

  const update = () => {
    const list = [...categories];
    const oldName = categories[editIndex!];
    list[editIndex!] = editText.trim();
    save(list);
    logCategoryManaged('edited', { oldName, newName: editText.trim() });
    setEditIndex(null);
    setEditText('');
  };

  const remove = (i: number) => {
    const removedCat = categories[i];
    const list = categories.filter((_, idx) => idx !== i);
    save(list);
    logCategoryManaged('deleted', removedCat);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    save(reordered);
    logCategoryManaged('reordered', { count: reordered.length });
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto flex flex-col">
      <div className="relative -mx-4">
        <div className="sticky top-0 h-[40px] bg-black z-50"></div>
        {/* Header */}
        <div className="sticky top-[40px] bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-40">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-9 h-9 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-2xl mx-auto w-full">
          {/* Add new category section */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Add New Category</label>
            <div className="flex gap-2">
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="Enter category name..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={add}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <FiPlus size={18} />
                Add
              </button>
            </div>
          </div>

          {/* Categories list section */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {categories.length > 0 && `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`}
            </h2>
            {categories.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2 text-4xl">📁</div>
                <p className="text-gray-500 font-medium">No categories yet</p>
                <p className="text-gray-400 text-sm">Add your first category above</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="category-list">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2.5"
                    >
                      {categories.map((cat, i) => (
                        <Draggable key={cat} draggableId={cat} index={i}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                                snapshot.isDragging
                                  ? 'bg-blue-50 border-blue-300 shadow-lg'
                                  : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-grow min-w-0">
                                <span
                                  {...provided.dragHandleProps}
                                  className="cursor-move text-gray-400 hover:text-gray-600 shrink-0 text-lg transition-colors"
                                  title="Drag to reorder"
                                >
                                  ☰
                                </span>
                                {editIndex === i ? (
                                  <input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="flex-1 min-w-0 px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="flex-1 min-w-0 truncate text-sm text-gray-900 font-medium">{cat}</span>
                                )}
                              </div>

                              <div className="flex gap-1.5 shrink-0 ml-3">
                                {editIndex === i ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={update}
                                      className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                      title="Save"
                                    >
                                      <FiCheck size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditIndex(null)}
                                      className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                      title="Cancel"
                                    >
                                      <FiX size={16} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditIndex(i);
                                        setEditText(cat);
                                      }}
                                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                      title="Edit category"
                                    >
                                      <FiEdit2 size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => remove(i)}
                                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                      title="Delete category"
                                    >
                                      <FiTrash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
