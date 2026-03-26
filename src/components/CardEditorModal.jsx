import { useState } from 'react';

function CardEditorModal({ cardData, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('content');

  const tabs = [
    { id: 'content', label: '?? Content' },
    { id: 'style', label: '?? Style' },
    { id: 'effects', label: '? Effects' },
    { id: 'gifts', label: '?? Gifts' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/80 backdrop-blur-sm transition-opacity">
      {/* Top Half (Close Area) */}
      <div className="flex-1 w-full" onClick={onClose}></div>

      {/* Bottom Half (Editor) */}
      <div className="bg-[#0b0f12]/95 border-t border-[#5ce7f2]/20 rounded-t-3xl p-6 shadow-[0_-20px_50px_rgba(92,231,242,0.1)] max-h-[60vh] overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between mb-6">
          <h3 className="page-title text-xl" style={{ fontSize: '1.5rem', margin: 0 }}>Edit Moment</h3>
          <div className="flex gap-3">
            <button className="ghost px-4 py-2" style={{ fontSize: '0.8rem' }} onClick={onClose}>Cancel</button>
            <button className="primary px-4 py-2" style={{ fontSize: '0.8rem' }} onClick={onSave}>Save</button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 border-b border-[#0e2329] mb-4" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#5ce7f2]/20 text-[#7ef7ff] border border-[#5ce7f2]/50' 
                  : 'text-[#dcf2f7]/50 hover:text-[#e8fbff]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto pr-2 flex-1 pb-8">
          {activeTab === 'content' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label className="eyebrow block mb-2">Card Title</label>
                <input type="text" className="search w-full" defaultValue={cardData?.title || ''} placeholder="Name your moment" />
              </div>
              <div>
                <label className="eyebrow block mb-2">Message</label>
                <textarea className="search w-full min-h-[100px]" style={{ resize: 'none' }} defaultValue={cardData?.message || ''} placeholder="Write your heart out..."></textarea>
              </div>
            </div>
          )}
          {activeTab === 'style' && (<div className="subtext text-center py-8">Style options coming soon...</div>)}
          {activeTab === 'effects' && (<div className="subtext text-center py-8">Effects coming soon...</div>)}
          {activeTab === 'gifts' && (<div className="subtext text-center py-8">Gifts coming soon...</div>)}
        </div>
      </div>
    </div>
  );
}
export default CardEditorModal;
