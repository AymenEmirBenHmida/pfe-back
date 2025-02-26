import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
@Entity({ name: 'user'})
export class User {
    @PrimaryGeneratedColumn()
    id:number;
    @Column()
    name:string;
    @Column({unique:true})
    email:string;
    @Column()
    password:string;
    @Column({default:true})
    active:boolean;

}
