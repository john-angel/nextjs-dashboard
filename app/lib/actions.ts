'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { stat } from 'fs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
      .number()
      .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status.'
    }),
    date: z.string(),
  });
   
const ValidateCreateInvoiceTypes = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData){  
    
  const validateFields = ValidateCreateInvoiceTypes.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    
    if(!validateFields.success){
      return {
        errors: validateFields.error.flatten().fieldErrors,
        message: 'Missing Fields. Failed to Create Invoice'
      }
    }
    
    const { customerId, amount, status } = validateFields.data;
    //It's a good practice to store monetary values in cents in your database to eliminate JavaScript floating-point errors
    //and ensure greater accuracy.
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    console.log(`Create invoice for customer ${ customerId }. Amount: ${ amount }. Status: ${ status }`);

    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})`;        
    } catch (error: any) {
        return { message: `Failed to Create Invoice. Error ${ error.message }` };
    }
    
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const ValidateUpdateInvoiceTypes = FormSchema.omit({ id: true, date: true });
 
export async function updateInvoice(id: string, prevState: State, formData: FormData) {
  
  const validateFields = ValidateUpdateInvoiceTypes.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if(!validateFields.success){
    return {
      errors: validateFields.error.flatten().fieldErrors,
      message: `Missing Fields. Failed to Update Invoice`
    }
  }

  const { customerId, amount, status } = validateFields.data;
 
  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error: any) {
      return { message: `Failed to Update Invoice. Error ${ error.message }` };
  }
  
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: 'Invoice deleted' };
  } catch (error: any) {
    return { message: `Failed to Delete Invoice. Error ${error.message}` };
  }
}