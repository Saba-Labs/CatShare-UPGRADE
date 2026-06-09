import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FiArrowLeft, FiPlus, FiEdit2, FiTrash2, FiCheck, FiX, FiSearch } from 'react-icons/fi';
import { useAuth } from './context/AuthContext';
import { syncCategories, syncProducts } from './services/supabaseSync';
import { logCategoryManaged } from './config/analyticsEvents';
import { readProductsWithLegacyFallback, safeSetProductsCache, safeSetInStorage, getStorageKey } from './utils/safeStorage';
import { productImageDisplayUrl } from './utils/imageUrl';

export default function ManageCategories() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('categories') || '[]');
    setCategories(stored);
  }, []);

  useEffect(() => {
    const stored = readProductsWithLegacyFallback(user?.uid || '');
    setProducts(stored);
  }, [user?.uid]);

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
    list[editIndex!] = editText.trim();
    save(list);
    logCategoryManaged('edited', editText.trim());
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
  };

  const toggleProductCategory = (productId: string, categoryName: string) => {
    const basedOnProducts = pendingProducts.length > 0 ? pendingProducts : products;
    const updatedProducts = basedOnProducts.map((p) => {
      if (p.id === productId) {
        const currentCategories = getProductCategoriesArray(p);
        if (currentCategories.includes(categoryName)) {
          return { ...p, category: currentCategories.filter((c: string) => c !== categoryName).join(', ') };
        } else {
          return { ...p, category: [...currentCategories, categoryName].join(', ') };
        }
      }
      return p;
    });
    setPendingProducts(updatedProducts);
  };

  const saveChanges = async () => {
    if (!user?.uid || pendingProducts.length === 0) return;

    setIsSaving(true);
    try {
      safeSetProductsCache(user.uid, pendingProducts);
      safeSetInStorage(getStorageKey('products', user.uid), pendingProducts);

      await syncProducts(user.uid, pendingProducts, { skipImageUrlAssertion: true });

      setProducts(pendingProducts);
      setPendingProducts([]);
      setSelectedCategory(null);
    } catch (err) {
      console.warn('⚠️ Failed to save products:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getProductCategoriesArray = (product: any): string[] => {
    if (!product.category) return [];
    if (Array.isArray(product.category)) return product.category;
    if (typeof product.category === 'string') {
      return product.category.split(',').map((c: string) => c.trim()).filter(Boolean);
    }
    return [];
  };

  const isProductInCategory = (product: any, categoryName: string) => {
    return getProductCategoriesArray(product).includes(categoryName);
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
                              className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all cursor-pointer ${
                                snapshot.isDragging
                                  ? 'bg-blue-50 border-blue-300 shadow-lg'
                                  : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
                              }`}
                              onClick={() => !editIndex && setSelectedCategory(cat)}
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
                                      onClick={() => setDeleteConfirm(i)}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Category?</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete "<strong>{categories[deleteConfirm]}</strong>"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  remove(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Detail Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-2xl h-[90vh] flex flex-col">
            {/* Detail Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-40">
              <h2 className="text-xl font-bold text-gray-900">{selectedCategory}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveChanges}
                  disabled={isSaving || pendingProducts.length === 0}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed"
                  title="Save changes"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setPendingProducts([]);
                    setSelectedCategory(null);
                  }}
                  disabled={isSaving}
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Close"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="relative">
                <FiSearch className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-auto">
              {(() => {
                const displayProducts = pendingProducts.length > 0 ? pendingProducts : products;
                const filtered = displayProducts.filter((p) =>
                  (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <p>{searchTerm ? 'No products found' : 'No products yet'}</p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y">
                    {filtered.map((product) => {
                      const imageSrc = product.image || product.imageUrl;
                      const displaySrc = imageSrc
                        ? productImageDisplayUrl(imageSrc, product.imageVersion)
                        : "";
                      return (
                        <div
                          key={product.id}
                          onClick={() => toggleProductCategory(product.id, selectedCategory)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isProductInCategory(product, selectedCategory)}
                            onChange={() => toggleProductCategory(product.id, selectedCategory)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                          />
                          <div className="w-12 h-12 rounded border border-gray-300 bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {displaySrc ? (
                              <img key={displaySrc} src={displaySrc} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <span className="text-[9px] text-gray-400">No img</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {product.name || 'Unnamed'}
                            </p>
                            {product.subtitle && (
                              <p className="text-xs text-gray-500 truncate">
                                {product.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
