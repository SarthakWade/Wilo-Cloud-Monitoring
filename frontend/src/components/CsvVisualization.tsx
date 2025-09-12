import { FiList, FiPlus, FiDownload, FiBarChart2 } from "react-icons/fi";
export default function CsvVisualization() {
  return (
    <div className="mx-auto max-w-7xl w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="md:col-span-3 space-y-4">
          <div className="card shadow-sm">
            <div className="p-4 card-header font-semibold flex items-center gap-2">
              <FiList className="w-4 h-4" />
              Data Files
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm text-foreground/70">No file selected</span>
              <button className="inline-flex items-center gap-2 rounded-md bg-brand text-white text-sm px-3 py-1.5 hover:bg-brand-hover">
                <FiPlus className="w-4 h-4" />
                Browse
              </button>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="p-4 card-header font-semibold flex items-center gap-2">
              <FiDownload className="w-4 h-4" />
              Export Options
            </div>
            <div className="p-4 space-y-2">
              <div className="text-sm text-foreground/70">Data Export</div>
              <button className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-token text-sm px-3 py-2 hover:bg-foreground/10">
                <FiDownload className="w-4 h-4" />
                Export Selected File as CSV
              </button>
            </div>
          </div>
        </aside>

        {/* Main Graph Card */}
        <section className="md:col-span-9">
          <div className="card shadow-sm">
            <div className="px-5 py-3 card-header flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <FiBarChart2 className="w-4 h-4 text-brand" />
                Acceleration Overview
              </div>
              <div className="flex items-center gap-2">
                <select className="text-sm rounded-md border border-token bg-transparent px-2 py-1">
                  <option>Max</option>
                  <option>Average</option>
                  <option>Min</option>
                </select>
              </div>
            </div>
            <div className="p-6 h-[440px] flex items-center justify-center">
              <div className="rounded-md border border-token px-4 py-3 text-sm text-foreground/70 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                No backend connected — Start the backend and refresh data
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
