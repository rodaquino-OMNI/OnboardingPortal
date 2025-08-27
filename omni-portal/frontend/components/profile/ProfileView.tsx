/**
 * ProfileView - Pure presentational component for profile
 * No business logic, only UI rendering
 */

import React from 'react';
import Image from 'next/image';
import { Profile, ProfileMetrics } from '@/modules/profile/ProfileService';

interface ProfileViewProps {
  profile: Profile;
  metrics: ProfileMetrics;
  onUpdate: (field: keyof Profile, value: any) => void;
  onSave: () => void;
  loading?: boolean;
  error?: string | null;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  metrics,
  onUpdate,
  onSave,
  loading = false,
  error = null
}) => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
              {profile.avatar ? (
                <Image 
                  src={profile.avatar} 
                  alt={profile.name}
                  width={80}
                  height={80}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl text-gray-500">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <p className="text-gray-600">{profile.email}</p>
              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                profile.status === 'active' ? 'bg-green-100 text-green-800' :
                profile.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {profile.status}
              </span>
            </div>
          </div>
          
          {/* Completion Meter */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {metrics.completionPercentage.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Profile Complete</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={profile.firstName || ''}
              onChange={(e) => onUpdate('firstName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={profile.lastName || ''}
              onChange={(e) => onUpdate('lastName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => onUpdate('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={profile.phone || ''}
              onChange={(e) => onUpdate('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Birth Date
            </label>
            <input
              type="date"
              value={profile.birthDate || ''}
              onChange={(e) => onUpdate('birthDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={profile.address || ''}
              onChange={(e) => onUpdate('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onSave}
            disabled={loading}
            className={`px-6 py-2 rounded-md text-white font-medium ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Completion Suggestions */}
      {metrics.missingFields.length > 0 && (
        <div className="bg-yellow-50 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-yellow-800 mb-2">
            Complete Your Profile
          </h3>
          <p className="text-sm text-yellow-700 mb-2">
            Add the following information to reach 100% completion:
          </p>
          <ul className="list-disc list-inside text-sm text-yellow-700">
            {metrics.missingFields.map((field) => (
              <li key={field}>
                {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};