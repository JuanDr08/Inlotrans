'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { eliminarNovedad } from './actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function DeleteNovedadButton({ id }: { id: string }) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()

    async function handleDelete() {
        if (!confirm('¿Estás seguro de eliminar esta novedad?')) return

        setIsDeleting(true)
        const result = await eliminarNovedad(id)
        setIsDeleting(false)

        if (!result.success) {
            toast.error(result.error)
        } else {
            toast.success('Novedad eliminada')
            router.refresh()
        }
    }

    return (
        <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
        >
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
        </Button>
    )
}
