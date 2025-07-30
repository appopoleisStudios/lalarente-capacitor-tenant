import Image from 'next/image'
interface Props {
  propertyImg: string
  propertyName: string
  leaseEnd: string
  rent: number
  nextPaymentDate: string
  onPayNow: () => void
  onReceipt: () => void
}
const PropertySummaryCard: React.FC<Props> = ({
  propertyImg, propertyName, leaseEnd, rent, nextPaymentDate, onPayNow, onReceipt
}) => (
  <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white mb-6 shadow-lg">
    <div className="flex items-center mb-3">
      <div className="w-16 h-16 rounded-lg overflow-hidden mr-4 flex-shrink-0">
        <Image src={propertyImg} alt={propertyName} width={64} height={64} className="w-16 h-16 object-cover rounded-lg" placeholder="blur" blurDataURL={propertyImg} />
      </div>
      <div>
        <div className="text-base font-semibold">{propertyName}</div>
        <div className="text-sm text-emerald-100">Lease till {leaseEnd}</div>
      </div>
    </div>
    <div className="grid grid-cols-2 items-center mb-3">
      <div>
        <div className="text-emerald-200 text-xs">Monthly Rent</div>
        <div className="text-2xl font-bold">R {rent.toLocaleString()}</div>
      </div>
      <div>
        <div className="text-emerald-200 text-xs">Next Payment</div>
        <div className="text-lg font-semibold">{nextPaymentDate}</div>
      </div>
    </div>
    <div className="flex space-x-2 mt-3">
      <button onClick={onPayNow} className="flex-1 bg-white text-emerald-700 font-semibold py-2 rounded-lg shadow hover:bg-emerald-50 text-sm">
        Pay Now
      </button>
      <button onClick={onReceipt} className="flex-1 bg-white text-emerald-600 font-medium py-2 rounded-lg shadow hover:bg-emerald-50 text-sm">
        Download Receipt
      </button>
    </div>
  </div>
)
export default PropertySummaryCard
