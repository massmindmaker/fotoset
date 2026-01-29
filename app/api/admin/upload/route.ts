/**
 * POST /api/admin/upload
 * Upload files for admin purposes (broadcasts, etc.)
 *
 * Uses Cloudflare R2 for storage
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/admin/session'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can upload
    if (!['super_admin', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'admin'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Get buffer and compress
    const arrayBuffer = await file.arrayBuffer()
    let buffer: Buffer = Buffer.from(arrayBuffer)

    // Compress image (except GIFs)
    let contentType = file.type
    if (file.type !== 'image/gif') {
      buffer = await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      contentType = 'image/jpeg'
    }

    // Generate unique key
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 10)
    const extension = contentType === 'image/gif' ? 'gif' : 'jpg'
    const key = `${folder}/${timestamp}-${randomId}.${extension}`

    // Upload to R2
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME
    if (!bucketName) {
      throw new Error('R2 bucket name not configured')
    }

    const r2Client = getR2Client()
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType
      })
    )

    // Generate public URL
    const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_URL
    const url = publicDomain
      ? `${publicDomain}/${key}`
      : `https://${bucketName}.r2.cloudflarestorage.com/${key}`

    return NextResponse.json({
      success: true,
      url,
      key,
      size: buffer.length,
      contentType
    })
  } catch (error) {
    console.error('[Admin Upload] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
