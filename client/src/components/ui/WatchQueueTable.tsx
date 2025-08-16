import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type WatchItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: string;
};

export const WatchQueueTable = ({
  data,
  onRemove,
}: {
  data: WatchItem[];
  onRemove: (id: string) => void;
}) => {
  const columns: ColumnDef<WatchItem>[] = [
    {
      accessorKey: "title",
      header: "Movie",
      cell: ({ getValue }) => (
        <span className="block truncate" title={String(getValue() ?? "")}>{String(getValue() ?? "")}</span>
      ),
    },
    {
      accessorKey: "startTime",
      header: () => <span className="block text-center">Start</span>,
      cell: ({ getValue }) => (
        <span className="block text-center tabular-nums">{String(getValue() ?? "")}</span>
      ),
    },
    {
      accessorKey: "endTime",
      header: () => <span className="block text-center">End</span>,
      cell: ({ getValue }) => (
        <span className="block text-center tabular-nums">{String(getValue() ?? "")}</span>
      ),
    },
    {
      accessorKey: "duration",
      header: () => <span className="block text-center">Duration</span>,
      cell: ({ getValue }) => (
        <span className="block text-center tabular-nums">{String(getValue() ?? "")}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <button
          className="text-xs text-blue-600 hover:underline"
          onClick={() => onRemove(row.original.id)}
        >
          Remove
        </button>
      ),
    },
  ];

  // Parse time string in 12-hour format with AM/PM, e.g. "12:15 PM"
  const parseTime = (timeStr: string) => {
    // Expecting format "hh:mm AM/PM"
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };
  const sortedData = [...data].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  const table = useReactTable({
    data: sortedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="mx-auto w-full max-w-3xl rounded-md border overflow-hidden">
      <div className="max-h-72 overflow-auto">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 bg-white">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-gray-500">
                  No movies scheduled.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};