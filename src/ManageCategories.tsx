import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FiArrowLeft, FiPlus } from 'react-icons/fi';
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
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 text-gray-700 hover:text-gray-900"
          title="Back"
        >
          <FiArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Manage Categories</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Add new category */}
        <div className="flex gap-2 mb-4">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="New category"
            className="flex-1 border px-3 py-2 rounded text-sm"
          />
          <button
            type="button"
            onClick={add}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            <FiPlus size={16} className="inline mr-1" />
            Add
          </button>
        </div>

        {/* Category list with drag-and-drop */}
        {categories.length === 0 ? (
          <p className="text-center text-gray-400 italic py-8">No categories yet</p>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="category-list">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2"
                >
                  {categories.map((cat, i) => (
                    <Draggable key={cat} draggableId={cat} index={i}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center justify-between bg-gray-100 p-3 rounded text-sm shadow"
                        >
                          <div className="flex items-center gap-2 flex-grow min-w-0">
                            <span
                              {...provided.dragHandleProps}
                              className="cursor-move text-gray-500 shrink-0"
                              title="Drag"
                            >
                              ☰
                            </span>
                            {editIndex === i ? (
                              <input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="flex-1 min-w-0 border px-2 py-1 rounded"
                                autoFocus
                              />
                            ) : (
                              <span className="flex-1 min-w-0 truncate">{cat}</span>
                            )}
                          </div>

                          <div className="flex gap-2 shrink-0">
                            {editIndex === i ? (
                              <>
                                <button
                                  type="button"
                                  onClick={update}
                                  className="text-blue-600 hover:underline text-sm font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditIndex(null)}
                                  className="text-gray-500 hover:underline text-sm font-medium"
                                >
                                  Cancel
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
                                  className="text-blue-600 hover:underline text-sm font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => remove(i)}
                                  className="text-red-600 hover:underline text-sm font-medium"
                                >
                                  Delete
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
  );
}
