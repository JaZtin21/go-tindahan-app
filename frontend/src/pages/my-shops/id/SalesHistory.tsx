import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, ReceiptText } from 'lucide-react';
import { useCheckoutHistory, useItemActionHistory } from '~/api/queries';


const PAGE_LIMIT = 10;

export const SalesHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { shopId } = useParams<{ shopId: string }>();
  const [activeTab, setActiveTab] = useState<'checkout' | 'actions'>('checkout');
  const [checkoutOffset, setCheckoutOffset] = useState(0);
  const [actionsOffset, setActionsOffset] = useState(0);
  const isSubscribed = true;

  const checkoutQuery = useCheckoutHistory({
    shopId: shopId || '',
    offset: checkoutOffset,
    pageLimit: PAGE_LIMIT,     // 👈 Flattened and renamed from limit
    activeTab: activeTab,      // 👈 Required property passed directly
    isSubscribed: isSubscribed,
  })

  const itemActionsQuery = useItemActionHistory({
    shopId: shopId || '',
    offset: actionsOffset,
    pageLimit: PAGE_LIMIT,     // 👈 Flattened and renamed from limit
    activeTab: activeTab,      // 👈 Required property passed directly
    isSubscribed: isSubscribed,
  })


  const checkoutData = checkoutQuery.data?.getCheckoutHistory;
  const actionData = itemActionsQuery.data?.getItemActionHistory;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(value);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const currentError = activeTab === 'checkout' ? checkoutQuery.error : itemActionsQuery.error;
  const isLoading = activeTab === 'checkout' ? checkoutQuery.loading : itemActionsQuery.loading;


  return (
    <div className="w-full min-h-screen text-text-main flex flex-col gap-2">
      <div className="flex justify-between items-center px-2">
        <button
          onClick={() => navigate(-1)}
          className="flex text-text-muted hover:text-text-main transition-colors duration-200 items-center gap-1.5 h-8 rounded-xl text-xs font-bold cursor-pointer active:scale-98"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>Go Back to My Shop</span>
        </button>
      </div>

      <div className="w-full flex flex-col">


        <div className="flex  rounded-sm w-full max-w-lg ">
          <button
            type="button"
            onClick={() => setActiveTab('checkout')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold transition-all duration-200 rounded-t-2xl cursor-pointer ${activeTab === 'checkout' ? 'bg-brand-gold text-text-white shadow-sm' : 'text-text-sub hover:text-text-main'}`}
          >
            <ReceiptText size={16} />
            Checkout History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold transition-all duration-200 rounded-t-2xl cursor-pointer ${activeTab === 'actions' ? 'bg-brand-gold text-text-white shadow-sm' : 'text-text-sub hover:text-text-main'}`}
          >
            <ClipboardList size={16} />
            Item Actions History
          </button>
        </div>

        {currentError && (
          <div className="p-4 rounded-xl bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs font-semibold">
            Failed to load history: {currentError.message}
          </div>
        )}

        {activeTab === 'checkout' && (
          <div className="flex flex-col gap-4 border-t border-border-main pt-6">
            {isLoading ? (
              <div className="text-sm text-text-muted py-8 text-center">Loading checkout history...</div>
            ) : (checkoutData?.batches?.length || 0) === 0 ? (
              <div className="text-sm text-text-muted py-8 text-center">No checkout batches recorded yet.</div>
            ) : (
              <div className="flex flex-col gap-6">
                {checkoutData?.batches.map((batch) => (
                  <div key={batch.id} className="rounded-2xl border border-border-main overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 pb-4 p-4 ">
                      <div>
                        <h3 className="text-sm font-bold text-text-main">Batch #{batch.id.slice(0, 8)}</h3>
                        <p className="text-xs text-text-muted mt-1">Sold at {formatDate(batch.soldAt)}</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-text-muted block">Items</span><span className="font-bold text-text-main">{batch.totalItems}</span></div>
                        <div><span className="text-text-muted block">Total Cost</span><span className="font-bold text-text-main">{formatCurrency(batch.totalCost)}</span></div>
                        <div><span className="text-text-muted block">Gross Sale</span><span className="font-bold text-text-main">{formatCurrency(batch.grossSale)}</span></div>
                        <div><span className="text-text-muted block">Gross Profit</span><span className="font-bold text-brand-green">{formatCurrency(batch.grossProfit)}</span></div>
                      </div>
                    </div>

                    <div className="overflow-x-auto bg-brand-gold/10 rounded-b-2xl isolate">
                      <div className="min-w-[800px] w-full flex flex-col">

                        <div className="bg-brand-gold/30 grid grid-cols-[3.5fr_1fr_1.5fr_1.5fr_1.5fr_1.5fr] items-center h-10 text-text-main text-xs font-bold uppercase tracking-wider px-4">
                          <div>Item Name</div>
                          <div>Qty</div>
                          <div>Cost Price</div>
                          <div>Selling Price</div>
                          <div>Line Cost</div>
                          <div>Line Sale</div>
                        </div>

                        <div className="overflow-y-auto overflow-x-hidden max-h-[160px] text-sm font-medium">
                          {batch.items.map((item: any, index: number) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[3.5fr_1fr_1.5fr_1.5fr_1.5fr_1.5fr] items-center h-11 border-b border-border-sub/20 text-text-main hover:bg-black/5 transition-colors px-4"
                            >
                              <div className="truncate font-semibold pr-4">
                                <span className="mr-1 text-text-sub">{index + 1}.</span>
                                {item.itemName}
                              </div>
                              <div>{item.quantity}</div>
                              <div>{formatCurrency(item.costPrice)}</div>
                              <div>{formatCurrency(item.sellingPrice)}</div>
                              <div>{formatCurrency(item.lineCostTotal)}</div>
                              <div>{formatCurrency(item.lineSaleTotal)}</div>
                            </div>
                          ))}
                        </div>

                      </div>
                    </div>
                  </div>

                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                disabled={checkoutOffset === 0}
                onClick={() => setCheckoutOffset((prev) => Math.max(0, prev - PAGE_LIMIT))}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-main hover:bg-bg-secondary text-text-sub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Previous
              </button>
              <button
                disabled={!checkoutData?.hasNextPage}
                onClick={() => setCheckoutOffset((prev) => prev + PAGE_LIMIT)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-main hover:bg-bg-secondary text-text-sub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="flex flex-col gap-4 border-t border-border-main pt-6">
            {isLoading ? (
              <div className="text-sm text-text-muted py-8 text-center">Loading item action history...</div>
            ) : (actionData?.records?.length || 0) === 0 ? (
              <div className="text-sm text-text-muted py-8 text-center">No item action history recorded yet.</div>
            ) : (
              <div className="overflow-x-auto border border-border-main rounded-2xl ">
                <table className="w-full min-w-[900px] text-left border-collapse px-4">
                  <thead>
                    <tr className="border-b border-border-sub text-text-muted text-xs font-bold uppercase tracking-wider h-12 ">
                      <th className="pl-4">Action</th>
                      <th>Item Name</th>
                      <th>Quantity</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-sub/20 text-sm font-medium">
                    {actionData?.records.map((record) => (
                      <tr key={record.id} className="hover:bg-item-hover/20 transition-colors h-12">
                        <td className="font-bold text-text-main capitalize pl-4">{record.action}</td>
                        <td>{record.itemName}</td>
                        <td>{record.quantity ?? '--'}</td>
                        <td>{formatDate(record.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                disabled={actionsOffset === 0}
                onClick={() => setActionsOffset((prev) => Math.max(0, prev - PAGE_LIMIT))}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-main hover:bg-bg-secondary text-text-sub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Previous
              </button>
              <button
                disabled={!actionData?.hasNextPage}
                onClick={() => setActionsOffset((prev) => prev + PAGE_LIMIT)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border-main hover:bg-bg-secondary text-text-sub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
