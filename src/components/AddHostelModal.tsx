import React from 'react';
import { X } from 'lucide-react';

interface AddHostelModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: { name: string; address: string };
  setFormData: (data: { name: string; address: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const AddHostelModal: React.FC<AddHostelModalProps> = ({ isOpen, onClose, formData, setFormData, onSubmit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Add New Hostel/PG</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Hostel Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Sunshine PG"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Address</label>
            <textarea
              required
              placeholder="Full address of the hostel"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              rows={3}
            />
          </div>
          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Create Hostel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddHostelModal;
