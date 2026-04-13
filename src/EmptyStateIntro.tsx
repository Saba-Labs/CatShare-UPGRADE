import React, { useState } from 'react';
import { FiPlus, FiChevronDown, FiImage } from 'react-icons/fi';
import {
  RiShoppingBag3Line,
  RiImageAddLine,
  RiGroupLine,
  RiExchangeDollarLine,
  RiShareForwardLine,
  RiFileList2Line,
  RiCheckLine,
  RiLightbulbFlashLine,
} from 'react-icons/ri';

interface EmptyStateIntroProps {
  onCreateProduct: () => void;
  onBulkAddFromGallery?: () => void;
}

export default function EmptyStateIntro({ onCreateProduct, onBulkAddFromGallery }: EmptyStateIntroProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const features = [
    {
      id: 'create',
      icon: <RiShoppingBag3Line className="w-6 h-6 text-gray-500" />,
      title: 'Create Products',
      description: 'Build your product catalog with images and details',
      details: 'Add product names, subtitles, pricing, categories, and images. Store all the information you need to organize and present your products professionally.',
    },
    {
      id: 'organize',
      icon: <RiImageAddLine className="w-6 h-6 text-gray-600" />,
      title: 'Organize & Manage',
      description: 'Keep your products organized and easily accessible',
      details: 'Drag to reorder products, categorize them, manage stock status per catalogue independently. Bulk edit multiple items at once to save time.',
    },
    {
      id: 'catalogues',
      icon: <RiExchangeDollarLine className="w-6 h-6 text-gray-600" />,
      title: 'Multiple Catalogues',
      description: 'Create unlimited custom catalogues for different pricing models',
      details: 'Start with the default Master catalogue and create unlimited custom catalogues for Wholesale, Resell, Distributor, or any other pricing strategy. Each catalogue has independent pricing and stock status.',
    },
    {
      id: 'share',
      icon: <RiShareForwardLine className="w-6 h-6 text-gray-600" />,
      title: 'Render & Share',
      description: 'Generate and share professional product previews',
      details: 'Render beautiful product images with your custom pricing, colors, and branding. Renders automatically generate images for all catalogues. Share the generated images directly with customers, retailers, and wholesalers.',
    },
    {
      id: 'backup',
      icon: <RiFileList2Line className="w-6 h-6 text-gray-600" />,
      title: 'Backup & Restore',
      description: 'Protect your data with ZIP backups',
      details: 'Create ZIP backups of your complete product catalog including all images and catalogue configurations. Restore from backups anytime to recover your entire setup.',
    },
  ];

  const useCases = [
    {
      title: 'E-commerce Sellers',
      description: 'Manage multi-channel product listings',
      benefits: ['Multiple pricing tiers', 'Stock tracking', 'Professional images'],
    },
    {
      title: 'Wholesale & Resell',
      description: 'Different prices for different channels',
      benefits: ['Separate catalogues', 'Independent stock', 'Easy sharing'],
    },
    {
      title: 'Multi-Channel Retailers',
      description: 'Professional product management',
      benefits: ['Unlimited catalogues', 'Custom branding', 'Mobile-friendly'],
    },
    {
      title: 'Small Businesses',
      description: 'Simple yet powerful product management',
      benefits: ['Easy to use', 'No setup required', 'Works offline'],
    },
  ];

  return (
    <div className="w-full max-w-xl mx-auto px-3 py-6">
      {/* Welcome Section */}
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold text-gray-500 mb-2">Welcome to CatShare</h1>
        <p className="text-sm text-gray-300 mb-1">
          Create, organize, and share your product catalog
        </p>
        <p className="text-xs text-gray-300">
          Professional product management with unlimited custom catalogues
        </p>
      </div>

      {/* Key Features Section */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-500 mb-4 flex items-center gap-2">
          <RiLightbulbFlashLine className="w-5 h-5 text-gray-500" />
          Key Features
        </h2>

        <div className="space-y-2">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="bg-white rounded-lg border border-gray-300 shadow-sm hover:shadow transition-shadow overflow-hidden"
            >
              <button
                onClick={() => toggleSection(feature.id)}
                className="w-full p-3 flex items-start gap-2 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="mt-0.5 shrink-0">{feature.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-500">{feature.title}</h3>
                  <p className="text-xs text-gray-300">{feature.description}</p>
                </div>
                <FiChevronDown
                  className={`w-4 h-4 text-gray-300 shrink-0 transition-transform duration-200 ${
                    expandedSection === feature.id ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSection === feature.id && (
                <div className="px-3 pb-3 pt-2 bg-gray-50 border-t border-gray-200">
                  <p className="text-xs text-gray-500">{feature.details}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How It Works Diagram */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-500 mb-4">How It Works</h2>

        <div className="bg-gray-100 rounded-lg p-5 border border-gray-300">
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-500 text-gray-100 flex items-center justify-center font-bold text-sm shrink-0">
                  1
                </div>
                <div className="w-0.5 h-10 bg-gray-300 my-1" />
              </div>
              <div className="pt-0.5">
                <h3 className="font-semibold text-sm text-gray-500">Create Products</h3>
                <p className="text-xs text-gray-300">
                  Click the '+' button to add products with images, names, pricing, and details
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-500 text-gray-100 flex items-center justify-center font-bold text-sm shrink-0">
                  2
                </div>
                <div className="w-0.5 h-10 bg-gray-300 my-1" />
              </div>
              <div className="pt-0.5">
                <h3 className="font-semibold text-sm text-gray-500">Create Catalogues</h3>
                <p className="text-xs text-gray-300">
                  Create custom catalogues with different pricing. Master catalogue is included by default
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-10 bg-gray-300 my-1" />
                <div className="w-8 h-8 rounded-full bg-gray-500 text-gray-100 flex items-center justify-center font-bold text-sm shrink-0">
                  3
                </div>
                <div className="w-0.5 h-10 bg-gray-300 my-1" />
              </div>
              <div className="pt-0.5">
                <h3 className="font-semibold text-sm text-gray-500">Organize & Render</h3>
                <p className="text-xs text-gray-300">
                  Organize with categories, mark stock status per catalogue, and render products as professional images
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-gray-500 text-gray-100 flex items-center justify-center font-bold text-sm shrink-0">
                  4
                </div>
              </div>
              <div className="pt-0.5">
                <h3 className="font-semibold text-sm text-gray-500">Share & Manage</h3>
                <p className="text-xs text-gray-300">
                  Share images with customers, backup your data, and manage inventory across all catalogues
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases Grid */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-500 mb-4">Perfect For</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {useCases.map((useCase, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-300 p-3 hover:shadow transition-shadow"
            >
              <h3 className="font-semibold text-sm text-gray-500 mb-1">{useCase.title}</h3>
              <p className="text-xs text-gray-300 mb-2">{useCase.description}</p>
              <div className="space-y-1">
                {useCase.benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                    <RiCheckLine className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Checklist */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-500 mb-4">What You Can Do</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            'Create unlimited products',
            'Upload product images',
            'Create unlimited catalogues',
            'Set custom pricing per catalogue',
            'Mark stock IN or OUT per catalogue',
            'Drag to reorder products',
            'Bulk edit items at once',
            'Add many products from gallery photos',
            'Render product images automatically',
            'ZIP backup & restore',
            'Organize with categories',
            'Search products quickly',
            'Share rendered images',
          ].map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-gray-300">
              <RiCheckLine className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-xs">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-600 rounded-lg p-6 text-center text-gray-50 mb-6">
        <h2 className="text-lg font-bold mb-2">Ready to Get Started?</h2>
        <p className="mb-4 text-xs text-gray-300">
          Create your first product in just a few seconds
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onCreateProduct}
            className="inline-flex items-center gap-2 bg-gray-300 text-gray-700 font-semibold px-6 py-2 rounded-full hover:bg-gray-200 transition-colors shadow hover:shadow-md text-sm"
          >
            <FiPlus size={18} />
            Create Your First Product
          </button>
          {onBulkAddFromGallery && (
            <button
              type="button"
              onClick={onBulkAddFromGallery}
              className="inline-flex items-center gap-2 bg-indigo-500/90 text-white font-semibold px-6 py-2 rounded-full hover:bg-indigo-400 transition-colors shadow hover:shadow-md text-sm"
            >
              <FiImage size={18} />
              Bulk add from gallery
            </button>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-200 border border-gray-400 rounded-lg p-3 text-xs text-gray-500">
        <p className="font-semibold mb-1">💡 Pro Tip:</p>
        <p>
          Access the full tutorial anytime from the menu. Learn about creating custom catalogues, bulk editing, image rendering, and category management to maximize your productivity!
        </p>
      </div>
    </div>
  );
}
