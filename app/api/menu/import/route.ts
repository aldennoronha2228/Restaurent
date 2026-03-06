/**
 * POST /api/menu/import
 * ----------------------
 * Imports menu items from an uploaded Excel file.
 * 
 * Expected Excel columns:
 * - Name (required)
 * - Price (required)
 * - Category (required - must match existing category name)
 * - Type (optional - 'veg' or 'non-veg', defaults to 'veg')
 * - Image URL (optional)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

function getServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment variables');
    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

interface ExcelRow {
    Name?: string;
    name?: string;
    Price?: number | string;
    price?: number | string;
    Category?: string;
    category?: string;
    Type?: string;
    type?: string;
    'Image URL'?: string;
    image_url?: string;
    ImageURL?: string;
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const tenantId = formData.get('tenantId') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
        }

        // Read the Excel file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
        }
        
        const sheet = workbook.Sheets[sheetName];
        const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
            return NextResponse.json({ error: 'No data found in Excel file' }, { status: 400 });
        }

        const supabase = getServiceClient();

        // Fetch existing categories for this tenant
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('id, name')
            .eq('tenant_id', tenantId);

        if (catError) throw catError;

        const categoryMap = new Map<string, string>();
        categories?.forEach(c => {
            categoryMap.set(c.name.toLowerCase(), c.id);
        });

        const results = {
            imported: 0,
            skipped: 0,
            errors: [] as string[],
            categoriesCreated: [] as string[],
        };

        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // Excel row number (1-indexed + header row)

            // Extract values (handle different column name formats)
            const name = (row.Name || row.name || '').toString().trim();
            const price = parseFloat((row.Price ?? row.price ?? '').toString());
            const categoryName = (row.Category || row.category || '').toString().trim();
            const typeRaw = (row.Type || row.type || 'veg').toString().toLowerCase().trim();
            const imageUrl = (row['Image URL'] || row.image_url || row.ImageURL || '').toString().trim();

            // Validate required fields
            if (!name) {
                results.errors.push(`Row ${rowNum}: Missing item name`);
                results.skipped++;
                continue;
            }

            if (isNaN(price) || price <= 0) {
                results.errors.push(`Row ${rowNum}: Invalid price for "${name}"`);
                results.skipped++;
                continue;
            }

            if (!categoryName) {
                results.errors.push(`Row ${rowNum}: Missing category for "${name}"`);
                results.skipped++;
                continue;
            }

            // Find or create category
            let categoryId = categoryMap.get(categoryName.toLowerCase());
            
            if (!categoryId) {
                // Create new category
                const { data: newCat, error: newCatError } = await supabase
                    .from('categories')
                    .insert([{ 
                        name: categoryName, 
                        tenant_id: tenantId, 
                        sort_order: categoryMap.size + 1 
                    }])
                    .select('id')
                    .single();

                if (newCatError || !newCat?.id) {
                    results.errors.push(`Row ${rowNum}: Failed to create category "${categoryName}"`);
                    results.skipped++;
                    continue;
                }

                categoryId = newCat.id;
                categoryMap.set(categoryName.toLowerCase(), newCat.id);
                results.categoriesCreated.push(categoryName);
            }

            // Normalize type
            const type: 'veg' | 'non-veg' = typeRaw.includes('non') || typeRaw === 'nonveg' ? 'non-veg' : 'veg';

            // Insert menu item
            const { error: insertError } = await supabase
                .from('menu_items')
                .insert([{
                    name,
                    price,
                    category_id: categoryId,
                    type,
                    image_url: imageUrl || null,
                    tenant_id: tenantId,
                    available: true,
                }]);

            if (insertError) {
                results.errors.push(`Row ${rowNum}: Failed to import "${name}" - ${insertError.message}`);
                results.skipped++;
                continue;
            }

            results.imported++;
        }

        return NextResponse.json({
            success: true,
            message: `Imported ${results.imported} items`,
            ...results,
        });

    } catch (err: any) {
        console.error('[menu/import] Error:', err);
        return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
    }
}
