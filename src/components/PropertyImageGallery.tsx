'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Upload, ChevronLeft, ChevronRight, GripVertical, Eye, Trash2 } from 'lucide-react'

interface PropertyImageGalleryProps {
  propertyId: string
  images: string[]
  onImagesChange?: (images: string[]) => void
  uploading?: boolean
  onUploadingChange?: (uploading: boolean) => void
  readOnly?: boolean
}

export default function PropertyImageGallery({ 
  propertyId, 
  images, 
  onImagesChange, 
  uploading = false, 
  onUploadingChange,
  readOnly = false
}: PropertyImageGalleryProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleMultipleUpload = async (files: FileList) => {
    if (!onUploadingChange) return
    
    try {
      onUploadingChange(true)
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`)
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error(`${file.name} is too large (max 10MB)`)
        }

        // Create unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${propertyId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('property-images')
          .getPublicUrl(fileName)

        return publicUrl
      })

      const newImageUrls = await Promise.all(uploadPromises)
      onImagesChange?.([...images, ...newImageUrls])
    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload images')
    } finally {
      onUploadingChange(false)
    }
  }

  const handleRemoveImage = async (_imageUrl: string, index: number) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      // Remove from array
      const updatedImages = images.filter((_, i) => i !== index)
      onImagesChange?.(updatedImages)

      // Adjust current index if needed
      if (currentImageIndex >= updatedImages.length) {
        setCurrentImageIndex(Math.max(0, updatedImages.length - 1))
      }
    } catch (error) {
      console.error('Remove error:', error)
      alert('Failed to remove image')
    }
  }

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newImages = [...images]
    const [movedImage] = newImages.splice(fromIndex, 1)
    if (typeof movedImage === 'string') {
      newImages.splice(toIndex, 0, movedImage)
      onImagesChange?.(newImages)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      handleReorder(draggedIndex, dropIndex)
    }
    setDraggedIndex(null)
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div className="relative">
        {images.length > 0 ? (
          <div className="relative h-64 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={images[currentImageIndex]}
              alt={`Property image ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                {currentImageIndex + 1} of {images.length}
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={() => setShowFullscreen(true)}
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-center text-gray-500">
              <Upload className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm">No images uploaded</p>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <div
              key={index}
              className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 ${
                index === currentImageIndex ? 'border-blue-500' : 'border-gray-200'
              }`}
              onClick={() => setCurrentImageIndex(index)}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Upload Section */}
      {!readOnly && (
        <div className="space-y-3">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 mb-1">
            {uploading ? 'Uploading images...' : 'Click to upload images or drag & drop'}
          </p>
          <p className="text-xs text-gray-500">PNG, JPG up to 10MB each</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleMultipleUpload(e.target.files)
            }
          }}
        />
      </div>
      )}

      {/* Image Management List */}
      {!readOnly && images.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Manage Images</h4>
          <div className="space-y-2">
            {images.map((image, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                <img
                  src={image}
                  alt={`Image ${index + 1}`}
                  className="w-12 h-12 object-cover rounded"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Image {index + 1}</p>
                  <p className="text-xs text-gray-500">
                    {index === 0 ? 'Cover image' : 'Gallery image'}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveImage(image, index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {showFullscreen && images.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={() => setShowFullscreen(false)}
              className="absolute top-4 right-4 text-white p-2 bg-black bg-opacity-50 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
            
            <img
              src={images[currentImageIndex]}
              alt={`Property image ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white p-2 bg-black bg-opacity-50 rounded-full"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white p-2 bg-black bg-opacity-50 rounded-full"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
