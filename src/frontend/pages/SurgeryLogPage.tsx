import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, User, BarChart3, List } from 'lucide-react';
import InpatientService from '../services/InpatientService';
import { OperationNote } from '../types/inpatient';
import SurgicalProcedureBreakdownChart from '../components/inpatient/SurgicalProcedureBreakdownChart';

const PAGE_SIZE = 20;

type SortBy = 'operationDate' | 'surgicalProcedure';
type SortDir = 'asc' | 'desc';

const SurgeryLogPage: React.FC = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<OperationNote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('operationDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [view, setView] = useState<'list' | 'analytics'>('list');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async (pageToLoad: number) => {
    try {
      setLoading(true);
      const result = await InpatientService.getAllOperationNotes({
        page: pageToLoad,
        limit: PAGE_SIZE,
        from: from || undefined,
        to: to || undefined,
        sortBy,
        sortDir,
      });
      setNotes(result.notes);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      console.error('Failed to load operation notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir]);

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    load(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scissors className="w-6 h-6 text-primary-600" />
            Surgery Log
          </h1>
          <p className="text-gray-600 mt-1">Every operation note recorded at this clinic, across all patients.</p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === 'list' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <List className="w-4 h-4" /> List
          </button>
          <button
            type="button"
            onClick={() => setView('analytics')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === 'analytics' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
        </div>
      </div>

      <form onSubmit={applyFilter} className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
          <input type="date" className="input text-sm py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
          <input type="date" className="input text-sm py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-secondary">Filter</button>
        {(from || to) && (
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => { setFrom(''); setTo(''); load(1); }}
          >
            Clear
          </button>
        )}
        {view === 'list' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
              <select
                className="input text-sm py-1.5"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="operationDate">Date</option>
                <option value="surgicalProcedure">Surgical Procedure</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Direction</label>
              <select
                className="input text-sm py-1.5"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as SortDir)}
              >
                <option value="desc">{sortBy === 'operationDate' ? 'Newest first' : 'Z to A'}</option>
                <option value="asc">{sortBy === 'operationDate' ? 'Oldest first' : 'A to Z'}</option>
              </select>
            </div>
          </>
        )}
        <span className="ml-auto text-sm text-gray-500">{total} surgery record{total === 1 ? '' : 's'}</span>
      </form>

      {view === 'analytics' ? (
        <SurgicalProcedureBreakdownChart from={from} to={to} />
      ) : loading ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
          <Scissors className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p>No operation notes recorded {from || to ? 'in this date range' : 'yet'}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => {
            const patient = note.admission?.patient;
            return (
              <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{note.surgicalProcedure}</h3>
                    {patient && (
                      <button
                        onClick={() => navigate(`/patients?patientId=${patient.id}`)}
                        className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800"
                      >
                        <User className="w-3.5 h-3.5" />
                        {patient.firstName} {patient.lastName}
                        <span className="text-gray-400">({patient.patientId})</span>
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(note.operationDate).toLocaleString()}</span>
                </div>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {note.indication && <div><dt className="inline font-medium text-gray-600">Indication: </dt><dd className="inline text-gray-800">{note.indication}</dd></div>}
                  <div><dt className="inline font-medium text-gray-600">Surgeon(s): </dt><dd className="inline text-gray-800">{note.surgeons}</dd></div>
                  {note.assistants && <div><dt className="inline font-medium text-gray-600">Assistant(s): </dt><dd className="inline text-gray-800">{note.assistants}</dd></div>}
                  {note.anaesthetics && <div><dt className="inline font-medium text-gray-600">Anaesthetics: </dt><dd className="inline text-gray-800">{note.anaesthetics}</dd></div>}
                  {note.anaesthetist && <div><dt className="inline font-medium text-gray-600">Anaesthetist: </dt><dd className="inline text-gray-800">{note.anaesthetist}</dd></div>}
                  {note.incision && <div><dt className="inline font-medium text-gray-600">Incision: </dt><dd className="inline text-gray-800">{note.incision}</dd></div>}
                  {note.findings && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Findings: </dt><dd className="inline text-gray-800">{note.findings}</dd></div>}
                  {note.procedure && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Procedure: </dt><dd className="inline text-gray-800">{note.procedure}</dd></div>}
                  {note.plan && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Plan: </dt><dd className="inline text-gray-800">{note.plan}</dd></div>}
                  {note.others && <div className="md:col-span-2"><dt className="inline font-medium text-gray-600">Others: </dt><dd className="inline text-gray-800">{note.others}</dd></div>}
                </dl>
                {note.recordedBy && (
                  <p className="text-xs text-gray-400 mt-2">
                    Recorded by {note.recordedBy.firstName} {note.recordedBy.lastName}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && !loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => load(page - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            className="btn btn-secondary"
            disabled={page >= totalPages}
            onClick={() => load(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default SurgeryLogPage;
