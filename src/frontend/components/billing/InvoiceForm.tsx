/**
 * Invoice Form Component
 * Create invoices with line items for patients
 */

import React, { useState, useEffect } from 'react';
import {
  CreateInvoiceDto,
  InvoiceLineItem,
  ServiceCatalog,
} from '../../types/billing.types';
import billingService from '../../services/billing.service';

interface InvoiceFormProps {
  patientId: string;
  patientName: string;
  onSuccess?: (invoice: any) => void;
  onCancel?: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  patientId,
  patientName,
  onSuccess,
  onCancel,
}) => {
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      description: '',
      quantity: 1,
      unitPrice: 0,
      tax: 0,
      total: 0,
    },
  ]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await billingService.getServices({ isActive: true });
      setServices(data);
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  const handleServiceSelect = (index: number, serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      description: service.serviceName,
      unitPrice: service.basePrice,
      tax: (service.basePrice * service.taxRate) / 100,
      total: service.basePrice + (service.basePrice * service.taxRate) / 100,
    };
    setLineItems(updatedItems);
  };

  const handleLineItemChange = (
    index: number,
    field: keyof InvoiceLineItem,
    value: any
  ) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    // Recalculate total
    const item = updatedItems[index];
    item.total = item.quantity * item.unitPrice + item.tax;

    setLineItems(updatedItems);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        tax: 0,
        total: 0,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateTax = () => {
    return lineItems.reduce((sum, item) => sum + item.tax, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - discount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const subtotal = calculateSubtotal();
      const tax = calculateTax();
      const totalAmount = calculateTotal();

      const invoiceData: CreateInvoiceDto = {
        patientId,
        subtotal,
        tax,
        discount,
        totalAmount,
        notes,
        dueDate: dueDate || undefined,
        lineItems,
      };

      const invoice = await billingService.createInvoice(invoiceData);
      onSuccess?.(invoice);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Due Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
            Due Date (Optional)
          </label>
          <input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input"
          />
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
          <button
            type="button"
            onClick={addLineItem}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            + Add Item
          </button>
        </div>

        <div className="space-y-4">
          {lineItems.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-4 items-start p-4 border border-gray-200 rounded-md"
            >
              {/* Service Select */}
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Service
                </label>
                <select
                  onChange={(e) => handleServiceSelect(index, e.target.value)}
                  className="input text-sm"
                >
                  <option value="">Custom Item...</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.serviceName} - {formatCurrency(service.basePrice)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) =>
                    handleLineItemChange(index, 'description', e.target.value)
                  }
                  required
                  className="input text-sm"
                  placeholder="Service description"
                />
              </div>

              {/* Quantity */}
              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Qty *
                </label>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    handleLineItemChange(index, 'quantity', parseInt(e.target.value) || 1)
                  }
                  required
                  min="1"
                  className="input text-sm"
                />
              </div>

              {/* Unit Price */}
              <div className="col-span-6 md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Unit Price *
                </label>
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) =>
                    handleLineItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                  }
                  required
                  min="0"
                  step="0.01"
                  className="input text-sm"
                />
              </div>

              {/* Tax */}
              <div className="col-span-6 md:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tax
                </label>
                <input
                  type="number"
                  value={item.tax}
                  onChange={(e) =>
                    handleLineItemChange(index, 'tax', parseFloat(e.target.value) || 0)
                  }
                  min="0"
                  step="0.01"
                  className="input text-sm"
                />
              </div>

              {/* Total */}
              <div className="col-span-5 md:col-span-1 flex items-end">
                <div className="text-sm font-medium text-gray-900">
                  {formatCurrency(item.total)}
                </div>
              </div>

              {/* Delete Button */}
              {lineItems.length > 1 && (
                <div className="col-span-1 flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Discount and Totals */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex justify-end">
          <div className="w-full md:w-1/2 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">{formatCurrency(calculateTax())}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <label htmlFor="discount" className="text-gray-600">
                Discount:
              </label>
              <input
                type="number"
                id="discount"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="w-32 input text-sm"
              />
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-3">
              <span>Total:</span>
              <span className="text-primary-600">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="input"
          placeholder="Additional notes or instructions"
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
};

export default InvoiceForm;
