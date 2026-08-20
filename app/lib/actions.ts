'use server';

import { z } from 'zod'; //TypeScript-first validation library
import { revalidatePath } from 'next/cache'; //Clearing cache and trigger new request to the server library
import { redirect } from 'next/navigation'; //Redirecting user lib
import postgres from 'postgres'; //postgresql lib
import { signIn } from '@/auth'
import { AuthError } from 'next-auth';

//SQL variable
const sql = postgres(process.env.DATABASE_STORAGE_POSTGRES_URL_NON_POOLING!, {ssl: 'require' });

//Handling type validation using ZOD
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greather than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.'
    }),
    date: z.string()
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true});

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData){
    //Validate form fields using Zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    //If form validation fails, return errors early. Otherwise, continue
    if(!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.'
        };
    }

    //Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date) VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        //If a database error occurs, return a more specific error.
        console.error(error);
        return {
            message: 'Database Error: Failed to Create Invoice.'
        };
    }

    //Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoice(prevstate: State, id: string, formData: FormData){
    //Validate form fields using Zod
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    //If form validatoin fails. return errors early. Otherwise, continue
    if(!validatedFields.success){
        return{
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing fields. Failed to Edit Invoices.'
        };
    }
    
    //Prepare data for insertion into the database
    const {customerId, amount, status} = validatedFields.data;
    const amountInCents = amount * 100;

    try {
        await sql `
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    } catch (error) {
        //If a database error occurs, return a more specific error
        console.error(error);
        return {
            message: 'Database Error: Failed to Update Invoice.'
        };
    }

    //Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');
    await sql `
        DELETE FROM invoices where id = ${id}
    `;

    revalidatePath('/dashboard/invoices');
}

export async function authenticate(prevState: string, formData: FormData){
    try{
        await signIn('credentials', formData);
    } catch (error) {
        if(error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.'
                default:
                    return 'Something went wrong.'
            }
        }
        throw error;
    }
}