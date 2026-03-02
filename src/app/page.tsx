'use client'

import { useState, useRef, useEffect } from 'react'
import { validarCedula, getUltimoRegistro, registrarAsistenciaAPI } from './actions'
import { getOperacionesActivas } from './(dashboard)/admin/operaciones-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Camera } from 'lucide-react'

export default function KioskoPage() {
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA')
  const [operacion, setOperacion] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [opcionesOp, setOpcionesOp] = useState<{ id: string, nombre: string }[]>([])

  useEffect(() => {
    async function loadOps() {
      const res = await getOperacionesActivas()
      if (res.success && res.data) {
        setOpcionesOp(res.data)
      }
    }
    loadOps()
  }, [])

  // Debounce cedula searching
  useEffect(() => {
    if (!cedula) {
      setNombre('')
      return
    }

    const timer = setTimeout(async () => {
      const res = await validarCedula(cedula)
      if (res.success && res.data) {
        setNombre(res.data.nombre)
        // Auto-asignamos la operación base del usuario si no hay una pre-seleccionada o si cambia
        if (res.data.operacion) {
          setOperacion(res.data.operacion)
        }
      } else {
        setNombre('')
        setOperacion('')
        toast.error(res.error || 'Cédula no válida')
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [cedula])

  const handleComprimirImagen = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (e) => {
        const img = new Image()
        img.src = e.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxWidth = 1024
          const maxHeight = 1024
          let width = img.width
          let height = img.height

          if (width > height && width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          } else if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }))
            } else {
              reject(new Error('Fallo compresión'))
            }
          }, 'image/jpeg', 0.75)
        }
      }
    })
  }

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const compressed = await handleComprimirImagen(file)
        setFotoFile(compressed)
        setFotoPreview(URL.createObjectURL(compressed))
      } catch (error) {
        setFotoFile(file)
        setFotoPreview(URL.createObjectURL(file))
      }
    }
  }

  const convertirImagenABase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Retornamos el string completo que incluye el prefijo 'data:image/...;base64,'
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nombre) {
      toast.error('Debe validar una cédula correcta primero.')
      return
    }

    if (tipo === 'SALIDA' && !operacion) {
      toast.error('Debe seleccionar la operación para la SALIDA.')
      return
    }

    if (!fotoFile) {
      toast.error('Es obligatorio tomar una fotografía para el registro.')
      return
    }

    setIsLoading(true)
    const toastId = toast.loading('Registrando tu asistencia...')

    try {
      let base64Image = ''
      if (fotoFile) {
        base64Image = await convertirImagenABase64(fotoFile)
      }

      const res = await registrarAsistenciaAPI({
        id: cedula,
        usuario_nombre: nombre,
        operacion,
        tipo,
        foto_base64: base64Image
      })

      if (res && res.success === false) {
        // Mostramos el error directamente sacado del objeto
        const errorMessage = res.error || 'Ocurrió un error al registrar'
        toast.error(errorMessage, { id: toastId, duration: 5000 })
        return
      }

      toast.success(`¡${tipo} registrada correctamente para ${nombre.split(' ')[0]}!`, { id: toastId, duration: 5000 })

      // Limpiar formulario si fue exitoso
      setTimeout(() => {
        setCedula('')
        setNombre('')
        setOperacion('')
        setTipo('ENTRADA')
        setFotoFile(null)
        setFotoPreview(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 1500)

    } catch (error: any) {
      console.error(error)
      toast.error('Ocurrió un error inesperado al procesar. Verifica tu conexión.', { id: toastId, duration: 5000 })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border relative overflow-hidden">
        {/* Adorno superior sutil */}
        <div className="h-2 w-full bg-blue-600 absolute top-0 left-0" />

        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Inlotrans</h1>
            <p className="text-sm text-slate-500">Registro de Asistencia</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cedula">Cédula</Label>
              <Input
                id="cedula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                required
                placeholder="Ingrese su cédula"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre Completo</Label>
              <Input id="nombre" value={nombre} readOnly disabled className="bg-slate-50" />
            </div>

            <div className="space-y-2 pt-2">
              <Label>Tipo de Registro</Label>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={tipo === 'ENTRADA' ? 'default' : 'outline'}
                  className={tipo === 'ENTRADA' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                  onClick={() => setTipo('ENTRADA')}
                >
                  ENTRADA
                </Button>
                <Button
                  type="button"
                  variant={tipo === 'SALIDA' ? 'default' : 'outline'}
                  className={tipo === 'SALIDA' ? 'bg-red-600 hover:bg-red-700' : ''}
                  onClick={() => setTipo('SALIDA')}
                >
                  SALIDA
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operacion">Operación</Label>
              <Select value={operacion} onValueChange={setOperacion}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent>
                  {opcionesOp.map(op => (
                    <SelectItem key={op.id} value={op.nombre}>{op.nombre}</SelectItem>
                  ))}
                  {opcionesOp.length === 0 && <SelectItem value="cargando" disabled>Cargando operaciones...</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Captura Fotográfica</Label>
              <label
                className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition"
              >
                <Camera className="w-5 h-5 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Tomar Foto</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFotoChange}
                />
              </label>

              {fotoPreview && (
                <div className="mt-3 rounded-lg overflow-hidden border border-slate-200">
                  <img src={fotoPreview} alt="Preview" className="w-full h-auto object-cover max-h-48" />
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-6 py-6 font-semibold text-lg shadow-sm"
              disabled={isLoading || !nombre}
            >
              {isLoading ? 'Guardando...' : 'Confirmar Registro'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
