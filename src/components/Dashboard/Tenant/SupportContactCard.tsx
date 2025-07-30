interface Props { onChat: () => void }
const SupportContactCard: React.FC<Props> = ({ onChat }) => (
  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100 mb-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">Need Help?</h3>
        <p className="text-sm text-gray-600">Our support team is here 24/7</p>
      </div>
      <button className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors" onClick={onChat}>
        Contact Us
      </button>
    </div>
  </div>
)
export default SupportContactCard
