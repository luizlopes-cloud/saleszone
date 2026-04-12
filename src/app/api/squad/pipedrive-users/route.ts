import { NextResponse } from 'next/server'
import { pipedriveGet } from '@/lib/squad/pipedrive'

interface PipedriveUser {
  id: number
  name: string
  email: string
  active_flag: boolean
}

export async function GET() {
  try {
    const allUsers: { id: number; name: string; email: string }[] = []
    let start = 0
    let hasMore = true

    while (hasMore && start < 2000) {
      const response = await pipedriveGet<PipedriveUser[]>('users', {
        start,
        limit: 500,
      })

      if (response.data) {
        for (const u of response.data) {
          if (u.active_flag) {
            allUsers.push({ id: u.id, name: u.name, email: u.email })
          }
        }
      }

      hasMore = response.additional_data?.pagination?.more_items_in_collection ?? false
      start = response.additional_data?.pagination?.next_start ?? start + 500
    }

    allUsers.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ users: allUsers })
  } catch (error) {
    console.error('Erro ao buscar usuários do Pipedrive:', error)
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
  }
}
