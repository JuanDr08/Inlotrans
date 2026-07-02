'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
    page: number
    pageSize: number
    total: number
}

export function Pagination({ page, pageSize, total }: PaginationProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    if (totalPages <= 1) return null

    const buildHref = (targetPage: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', String(targetPage))
        return `${pathname}?${params.toString()}`
    }

    const hasPrev = page > 1
    const hasNext = page < totalPages

    return (
        <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({total} resultados)
            </p>
            <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" disabled={!hasPrev}>
                    {hasPrev ? (
                        <Link href={buildHref(page - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </Link>
                    ) : (
                        <span>
                            <ChevronLeft className="h-4 w-4" />
                            Anterior
                        </span>
                    )}
                </Button>
                <Button asChild variant="outline" size="sm" disabled={!hasNext}>
                    {hasNext ? (
                        <Link href={buildHref(page + 1)}>
                            Siguiente
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    ) : (
                        <span>
                            Siguiente
                            <ChevronRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>
            </div>
        </div>
    )
}
